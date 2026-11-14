import type { FastifyInstance } from 'fastify';
import { emptyQuery } from '@storefront/shared';
import type { AuthService } from '../auth/service.js';
import {
  apiRoute,
  bearerSecurity,
  errorResponses,
} from '../../plugins/route.js';
import {
  idParams,
  notificationDto,
  notificationInbox,
  notificationQuery,
  notificationReadAllDto,
} from './schemas.js';
import type { NotificationService } from './service.js';

export async function notificationRoutes(
  app: FastifyInstance,
  service: NotificationService,
  auth: AuthService,
) {
  const api = apiRoute(app);
  const schema = {
    tags: ['Notifications'],
    security: bearerSecurity,
    querystring: emptyQuery,
  };
  api.get(
    '/notifications',
    {
      preHandler: auth.requireAuth,
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: {
        ...schema,
        querystring: notificationQuery,
        response: { 200: notificationInbox, ...errorResponses },
      },
    },
    async (request) => service.list(request.storefrontUser, request.query),
  );
  api.patch(
    '/notifications/:id/read',
    {
      preHandler: auth.requireAuth,
      schema: {
        ...schema,
        params: idParams,
        response: { 200: notificationDto, ...errorResponses },
      },
    },
    async (request) => service.read(request.storefrontUser, request.params.id),
  );
  api.post(
    '/notifications/read-all',
    {
      preHandler: auth.requireAuth,
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        ...schema,
        response: { 200: notificationReadAllDto, ...errorResponses },
      },
    },
    async (request) => service.readAll(request.storefrontUser, new Date()),
  );
}
