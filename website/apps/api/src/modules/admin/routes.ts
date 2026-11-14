import type { FastifyInstance } from 'fastify';
import { emptyQuery } from '@storefront/shared';
import type { AuthService } from '../auth/service.js';
import {
  apiRoute,
  bearerSecurity,
  errorResponses,
} from '../../plugins/route.js';
import {
  adminOrderDto,
  adminOrderList,
  adminOrderPatch,
  idParams,
  pagination,
  uploadSignatureDto,
  uploadSignatureInput,
} from './schemas.js';
import type { AdminService } from './service.js';

export async function adminRoutes(
  app: FastifyInstance,
  service: AdminService,
  auth: AuthService,
) {
  const api = apiRoute(app);
  const schema = {
    tags: ['Admin'],
    security: bearerSecurity,
    querystring: emptyQuery,
  };
  const preHandler = auth.requireAdmin;
  api.get(
    '/admin/orders',
    {
      preHandler,
      schema: {
        ...schema,
        querystring: pagination,
        response: { 200: adminOrderList, ...errorResponses },
      },
    },
    async (request) => service.list(request.query),
  );
  api.patch(
    '/admin/orders/:id/status',
    {
      preHandler,
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: {
        ...schema,
        params: idParams,
        body: adminOrderPatch,
        response: { 200: adminOrderDto, ...errorResponses },
      },
    },
    async (request) => service.changeStatus(request.params.id, request.body),
  );
  api.post(
    '/admin/uploads/signature',
    {
      preHandler,
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      schema: {
        ...schema,
        body: uploadSignatureInput,
        response: { 200: uploadSignatureDto, ...errorResponses },
      },
    },
    async () => service.uploadSignature(),
  );
}
