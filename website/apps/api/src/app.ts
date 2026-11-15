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
import { clerkAdapter, type ClerkAdapter } from './plugins/clerk.js';
import { authService } from './modules/auth/service.js';
import { authRoutes } from './modules/auth/routes.js';
import { catalogueModels } from './models/catalogue.js';
import { orderModel } from './models/order.js';
import { catalogueService } from './modules/products/service.js';
import { catalogueRoutes } from './modules/products/routes.js';
import { cartModel } from './models/cart.js';
import { customerService } from './modules/customer/service.js';
import { customerRoutes } from './modules/customer/routes.js';
import { checkoutModel } from './models/checkout.js';
import { checkoutService } from './modules/checkout/service.js';
import {
  stripeProvider,
  type PaymentProvider,
} from './modules/checkout/payment-provider.js';
import { orderService } from './modules/checkout/orders.js';
import { checkoutRoutes } from './modules/checkout/routes.js';
import { reviewRoutes } from './modules/reviews/routes.js';
import { reviewService } from './modules/reviews/service.js';
import { notificationModel } from './models/notification.js';
import { notificationService } from './modules/notifications/service.js';
import { notificationRoutes } from './modules/notifications/routes.js';
import { adminRoutes } from './modules/admin/routes.js';
import { adminService } from './modules/admin/service.js';
import { adminInsights } from './modules/admin/insights.js';
import { adminInsightRoutes } from './modules/admin/insight-routes.js';
import { bannerModels } from './models/banner.js';
import { bannerService } from './modules/admin/banners.js';
import { bannerRoutes } from './modules/admin/banner-routes.js';
import { adminProducts } from './modules/admin/products.js';
import { adminProductRoutes } from './modules/admin/product-routes.js';
import { createMedia, type MediaAdapter } from './modules/admin/media.js';

export async function buildApp(
  env: Env,
  options: {
    logger?: boolean;
    clerk?: ClerkAdapter;
    payment?: PaymentProvider;
    media?: MediaAdapter;
  } = {},
) {
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
    if (request.url.startsWith('/api/v1/admin/'))
      reply.header('Cache-Control', 'private, no-store');
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
      openapi: {
        info: { title: 'ShopEase Storefront API', version: '0.2.0' },
        components: {
          securitySchemes: {
            clerkBearer: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
      },
      transform: (input) => {
        const result = jsonSchemaTransform(input);
        if (input.url.includes('/webhooks/')) {
          return {
            ...result,
            schema: {
              ...result.schema,
              body: {
                type: 'object',
                additionalProperties: true,
                description:
                  'Send the signed provider JSON with its original whitespace and bytes.',
              },
            },
          };
        }
        return result;
      },
    });
    const database = await connectDatabase(app, env.MONGODB_URI);
    const auth = authService(
      database,
      options.clerk ?? clerkAdapter(env),
      env.ADMIN_EMAIL,
      env.CLERK_WEBHOOK_SIGNING_SECRET,
    );
    await Promise.all([
      auth.users.createIndexes(),
      auth.receipts.createIndexes(),
    ]);
    const catalogue = catalogueModels(database);
    const orders = orderModel(database);
    await app.register(
      (scope) =>
        adminInsightRoutes(
          scope,
          adminInsights(
            auth.users,
            orders,
            catalogue.products,
            env.ADMIN_LOW_STOCK,
          ),
          auth,
        ),
      { prefix: '/api/v1' },
    );
    const checkouts = checkoutModel(database);
    const media = createMedia(env, app.log, options.media);
    const banners = bannerModels(database);
    await banners.banners.createIndexes();
    await banners.guard.updateOne(
      { _id: 'banners' },
      { $setOnInsert: { revision: 0 } },
      { upsert: true },
    );
    await app.register(
      (scope) =>
        bannerRoutes(scope, bannerService(database, banners, media, env), auth),
      { prefix: '/api/v1' },
    );
    await app.register(
      (scope) =>
        adminProductRoutes(
          scope,
          adminProducts(database, catalogue, checkouts, orders, media, env),
          auth,
        ),
      { prefix: '/api/v1' },
    );
    const inbox = notificationModel(database);
    await inbox.createIndexes();
    const notifications = notificationService(inbox, orders);
    await app.register(
      (scope) =>
        adminRoutes(
          scope,
          adminService(
            database,
            orders,
            notifications,
            env,
            auth.users,
            checkouts,
          ),
          auth,
        ),
      { prefix: '/api/v1' },
    );
    await app.register(
      (scope) => notificationRoutes(scope, notifications, auth),
      { prefix: '/api/v1' },
    );
    await app.register(
      (scope) =>
        reviewRoutes(scope, reviewService(database, catalogue, orders), auth),
      { prefix: '/api/v1' },
    );
    const carts = cartModel(database);
    await checkouts.createIndexes();
    const payment =
      options.payment ??
      stripeProvider(env.STRIPE_SECRET_KEY, env.STRIPE_WEBHOOK_SECRET);
    const checkout = checkoutService(
      database,
      {
        checkouts,
        carts,
        users: auth.users,
        products: catalogue.products,
        orders,
        receipts: auth.receipts,
      },
      env,
      payment,
      app.log,
    );
    if (payment && env.NODE_ENV !== 'test') {
      let running: Promise<void> | undefined;
      const timer = setInterval(() => {
        if (running) return;
        running = checkout
          .sweep()
          .catch(() => app.log.error('Checkout sweep failed'))
          .finally(() => {
            running = undefined;
          });
      }, 60_000);
      timer.unref();
      app.addHook('preClose', async () => {
        clearInterval(timer);
        await running;
      });
    }
    await app.register(
      (scope) =>
        checkoutRoutes(
          scope,
          checkout,
          orderService(orders, catalogue.reviews),
          auth,
        ),
      { prefix: '/api/v1' },
    );
    await carts.createIndexes();
    await app.register(
      (scope) =>
        customerRoutes(
          scope,
          customerService(database, carts, auth.users, catalogue.products, env),
          auth,
        ),
      { prefix: '/api/v1' },
    );
    await Promise.all([
      catalogue.products.createIndexes(),
      catalogue.reviews.createIndexes(),
      orders.createIndexes(),
    ]);
    await app.register(
      (scope) =>
        catalogueRoutes(scope, catalogueService(catalogue, orders, auth.users)),
      { prefix: '/api/v1' },
    );
    await app.register((scope) => authRoutes(scope, auth), {
      prefix: '/api/v1',
    });
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
