import type { FastifyInstance } from 'fastify';
import {
  adminCustomerList,
  adminCustomersQuery,
  adminStatsDto,
  adminStatsQuery,
} from '@storefront/shared';
import { apiRoute, errorResponses } from '../../plugins/route.js';
import type { AuthService } from '../auth/service.js';
import { adminSchema } from './product-routes.js';
import type { AdminInsights } from './insights.js';

export async function adminInsightRoutes(
  app: FastifyInstance,
  service: AdminInsights,
  auth: AuthService,
) {
  const api = apiRoute(app);
  const preHandler = auth.requireAdmin;
  api.get(
    '/admin/customers',
    {
      preHandler,
      schema: {
        ...adminSchema,
        querystring: adminCustomersQuery,
        response: { 200: adminCustomerList, ...errorResponses },
      },
    },
    (request) => service.customers(request.query),
  );
  api.get(
    '/admin/stats',
    {
      preHandler,
      schema: {
        ...adminSchema,
        querystring: adminStatsQuery,
        response: { 200: adminStatsDto, ...errorResponses },
      },
    },
    (request) => service.stats(request.query.range),
  );
}
