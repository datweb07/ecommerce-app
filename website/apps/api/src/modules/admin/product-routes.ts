import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  adminProductCreate,
  adminProductDto,
  adminProductList,
  adminProductPatch,
  adminProductQuery,
  adminStockInput,
  emptyQuery,
  idParams,
} from '@storefront/shared';
import { z } from 'zod';
import {
  apiRoute,
  bearerSecurity,
  errorResponses,
} from '../../plugins/route.js';
import type { AuthService } from '../auth/service.js';
import type { AdminProducts } from './products.js';

export const adminSchema = {
  tags: ['Admin'],
  security: bearerSecurity,
  querystring: emptyQuery,
};
export const adminWrite = { rateLimit: { max: 20, timeWindow: '1 minute' } };
export const deletedDto = z.object({ deleted: z.literal(true) });
export function audit(
  request: FastifyRequest,
  action: string,
  targetId: string,
  extra?: { reason: string; delta: number },
) {
  request.log.info(
    {
      adminId: request.storefrontUser._id.toString(),
      action,
      targetId,
      ...extra,
    },
    'Admin write',
  );
}
export async function adminProductRoutes(
  app: FastifyInstance,
  service: AdminProducts,
  auth: AuthService,
) {
  const api = apiRoute(app);
  const preHandler = auth.requireAdmin;
  const response = { 200: adminProductDto, ...errorResponses };
  api.get(
    '/admin/products',
    {
      preHandler,
      schema: {
        ...adminSchema,
        querystring: adminProductQuery,
        response: { 200: adminProductList, ...errorResponses },
      },
    },
    (request) => service.list(request.query),
  );
  api.get(
    '/admin/products/:id',
    { preHandler, schema: { ...adminSchema, params: idParams, response } },
    (request) => service.get(request.params.id),
  );
  api.post(
    '/admin/products',
    {
      preHandler,
      config: adminWrite,
      schema: {
        ...adminSchema,
        body: adminProductCreate,
        response: { 201: adminProductDto, ...errorResponses },
      },
    },
    async (request, reply) => {
      const product = await service.create(request.body);
      audit(request, 'product.create', product.id);
      return reply.code(201).send(product);
    },
  );
  api.patch(
    '/admin/products/:id',
    {
      preHandler,
      config: adminWrite,
      schema: {
        ...adminSchema,
        params: idParams,
        body: adminProductPatch,
        response,
      },
    },
    async (request) => {
      const product = await service.update(request.params.id, request.body);
      audit(request, 'product.update', product.id);
      return product;
    },
  );
  api.post(
    '/admin/products/:id/stock',
    {
      preHandler,
      config: adminWrite,
      schema: {
        ...adminSchema,
        params: idParams,
        body: adminStockInput,
        response,
      },
    },
    async (request) => {
      const product = await service.stock(request.params.id, request.body);
      audit(request, 'product.stock', product.id, request.body);
      return product;
    },
  );
  api.delete(
    '/admin/products/:id',
    {
      preHandler,
      config: adminWrite,
      schema: {
        ...adminSchema,
        params: idParams,
        response: { 200: deletedDto, ...errorResponses },
      },
    },
    async (request) => {
      await service.remove(request.params.id);
      audit(request, 'product.delete', request.params.id);
      return { deleted: true as const };
    },
  );
}
