import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from '@fastify/type-provider-zod';
import { errorResponseSchema, healthResponseSchema } from '@storefront/shared';
import type { Env } from './config/env.js';
import { connectDatabase } from './plugins/database.js';
import { registerErrors } from './plugins/errors.js';

export async function buildApp(env: Env, options: { logger?: boolean } = {}) {
  const app = Fastify({
    logger:
      options.logger === false
        ? false
        : {
            level: env.LOG_LEVEL,
            redact: [
              'req.headers.authorization',
              'req.headers.cookie',
              'res.headers["set-cookie"]',
            ],
            serializers: {
              req: (request: { method: string; url: string }) => ({
                method: request.method,
                path: request.url.split('?')[0],
              }),
            },
          },
    bodyLimit: 1024 * 1024,
    requestTimeout: 15_000,
    requestIdHeader: false,
    genReqId: (request) => {
      const id = request.headers['x-request-id'];
      return typeof id === 'string' && /^[a-zA-Z0-9_-]{8,64}$/.test(id)
        ? id
        : randomUUID();
    },
  }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrors(app);
  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  try {
    await app.register(cors, {
      origin: env.CORS_ORIGINS,
      credentials: false,
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Request-Id',
        'Idempotency-Key',
      ],
      exposedHeaders: ['X-Request-Id'],
      methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    });
    await app.register(helmet);
    await app.register(sensible);
    await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
    await app.register(swagger, {
      openapi: { info: { title: 'ShopEase Storefront API', version: '0.1.0' } },
      transform: jsonSchemaTransform,
    });
    const database = await connectDatabase(app, env.MONGODB_URI);
    const schema = {
      tags: ['health'],
      response: { 200: healthResponseSchema, 503: errorResponseSchema },
    };
    app.get(
      '/health/live',
      { schema, config: { rateLimit: false } },
      async (request) => ({
        status: 'ok' as const,
        service: 'storefront-api' as const,
        requestId: request.id,
      }),
    );
    app.get(
      '/health/ready',
      { schema, config: { rateLimit: false } },
      async (request, reply) => {
        try {
          if (database.readyState !== 1 || !database.db)
            throw new Error('Database unavailable');
          await database.db.admin().ping({ maxTimeMS: 1000 });
          return {
            status: 'ok' as const,
            service: 'storefront-api' as const,
            requestId: request.id,
          };
        } catch {
          return reply.code(503).send({
            error: {
              code: 'UNAVAILABLE',
              message: 'Dịch vụ tạm thời chưa sẵn sàng.',
            },
            requestId: request.id,
          });
        }
      },
    );
    // No public documentation in production until access control is implemented.
    if (env.NODE_ENV !== 'production') {
      app.get('/openapi.json', { schema: { hide: true } }, async () =>
        app.swagger(),
      );
      await app.register(swaggerUi, { routePrefix: '/docs' });
    }
    return app;
  } catch (error) {
    await app.close();
    throw error;
  }
}
