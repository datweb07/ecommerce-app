import type { FastifyInstance } from 'fastify';
import {
  acknowledgement,
  emptyQuery,
  profileDto,
  profilePatch,
  rawWebhookBody,
  svixHeaders,
} from '@storefront/shared';
import {
  apiRoute,
  bearerSecurity,
  errorResponses,
  rawJson,
} from '../../plugins/route.js';
import type { AuthService } from './service.js';

export async function authRoutes(app: FastifyInstance, auth: AuthService) {
  const api = apiRoute(app);
  const schema = {
    tags: ['Account'],
    security: bearerSecurity,
    querystring: emptyQuery,
    response: { 200: profileDto, ...errorResponses },
  };
  api.get('/me', { schema, preHandler: auth.requireAuth }, async (request) =>
    auth.profile(request.storefrontUser),
  );
  api.patch(
    '/me',
    {
      schema: { ...schema, body: profilePatch },
      config: { rateLimit: { max: 15, timeWindow: '1 minute' } },
      preHandler: auth.requireAuth,
    },
    async (request) => auth.patch(request.storefrontUser, request.body),
  );
  await app.register(async (scope) => {
    rawJson(scope);
    apiRoute(scope).post(
      '/webhooks/clerk',
      {
        schema: {
          tags: ['Webhooks'],
          querystring: emptyQuery,
          headers: svixHeaders,
          body: rawWebhookBody,
          response: { 200: acknowledgement, ...errorResponses },
        },
        config: { rateLimit: false },
      },
      async (request) => {
        await auth.receive(request.body, request.headers);
        return { received: true as const };
      },
    );
  });
}
