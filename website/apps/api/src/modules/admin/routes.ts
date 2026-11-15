import type { FastifyInstance } from 'fastify';
import {
  adminMeDto,
  adminOrderDetailDto,
  adminOrdersQuery,
  adminReconciliationList,
  emptyQuery,
} from '@storefront/shared';
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
import { audit } from './product-routes.js';

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
    '/admin/me',
    {
      preHandler,
      schema: { ...schema, response: { 200: adminMeDto, ...errorResponses } },
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'private, no-store');
      return {
        id: request.storefrontUser._id.toString(),
        isAdmin: true as const,
      };
    },
  );
  api.get(
    '/admin/orders',
    {
      preHandler,
      schema: {
        ...schema,
        querystring: adminOrdersQuery,
        response: { 200: adminOrderList, ...errorResponses },
      },
    },
    async (request) => service.list(request.query),
  );
  api.get(
    '/admin/orders/:id',
    {
      preHandler,
      schema: {
        ...schema,
        params: idParams,
        response: { 200: adminOrderDetailDto, ...errorResponses },
      },
    },
    (request) => service.detail(request.params.id),
  );
  api.get(
    '/admin/reconciliation',
    {
      preHandler,
      schema: {
        ...schema,
        querystring: pagination,
        response: { 200: adminReconciliationList, ...errorResponses },
      },
    },
    (request) => service.reconciliation(request.query),
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
    async (request) => {
      const order = await service.changeStatus(request.params.id, request.body);
      audit(request, 'order.' + request.body.status, order.id);
      return order;
    },
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
    async (request) => {
      const signature = service.uploadSignature(request.body);
      audit(request, 'upload.signature', signature.params.public_id);
      return signature;
    },
  );
}
