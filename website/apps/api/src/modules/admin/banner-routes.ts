import type { FastifyInstance } from 'fastify';
import {
  adminBannerCreate,
  adminBannerDto,
  adminBannerList,
  adminBannerPatch,
  bannerOrderInput,
  emptyQuery,
  idParams,
  pagination,
  publicBannerList,
} from '@storefront/shared';
import { apiRoute, errorResponses } from '../../plugins/route.js';
import type { AuthService } from '../auth/service.js';
import {
  adminSchema,
  adminWrite,
  audit,
  deletedDto,
} from './product-routes.js';
import type { BannerService } from './banners.js';

export async function bannerRoutes(
  app: FastifyInstance,
  service: BannerService,
  auth: AuthService,
) {
  const api = apiRoute(app);
  const preHandler = auth.requireAdmin;
  const response = { 200: adminBannerDto, ...errorResponses };
  api.get(
    '/banners',
    {
      schema: {
        tags: ['Banners'],
        querystring: emptyQuery,
        response: { 200: publicBannerList, ...errorResponses },
      },
    },
    async (_request, reply) => {
      reply.header('Cache-Control', 'public, max-age=60');
      return service.active();
    },
  );
  api.get(
    '/admin/banners',
    {
      preHandler,
      schema: {
        ...adminSchema,
        querystring: pagination,
        response: { 200: adminBannerList, ...errorResponses },
      },
    },
    (request) => service.list(request.query),
  );
  api.post(
    '/admin/banners',
    {
      preHandler,
      config: adminWrite,
      schema: {
        ...adminSchema,
        body: adminBannerCreate,
        response: { 201: adminBannerDto, ...errorResponses },
      },
    },
    async (request, reply) => {
      const banner = await service.create(request.body);
      audit(request, 'banner.create', banner.id);
      return reply.code(201).send(banner);
    },
  );
  api.patch(
    '/admin/banners/:id',
    {
      preHandler,
      config: adminWrite,
      schema: {
        ...adminSchema,
        params: idParams,
        body: adminBannerPatch,
        response,
      },
    },
    async (request) => {
      const banner = await service.update(request.params.id, request.body);
      audit(request, 'banner.update', banner.id);
      return banner;
    },
  );
  api.delete(
    '/admin/banners/:id',
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
      audit(request, 'banner.delete', request.params.id);
      return { deleted: true as const };
    },
  );
  api.put(
    '/admin/banners/order',
    {
      preHandler,
      config: adminWrite,
      schema: {
        ...adminSchema,
        body: bannerOrderInput,
        response: { 200: bannerOrderInput, ...errorResponses },
      },
    },
    async (request) => {
      const result = await service.reorder(request.body.ids);
      audit(request, 'banner.reorder', 'banners');
      return result;
    },
  );
}
