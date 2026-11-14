import type { FastifyInstance } from 'fastify';
import { emptyQuery } from '@storefront/shared';
import { apiRoute, errorResponses } from '../../plugins/route.js';
import {
  categoryListDto,
  idParams,
  pagination,
  productDto,
  productListDto,
  productQuery,
  publicReviewsDto,
  relatedDto,
} from './schemas.js';
import { productView, type catalogueService } from './service.js';

export async function catalogueRoutes(
  app: FastifyInstance,
  service: ReturnType<typeof catalogueService>,
) {
  const api = apiRoute(app);
  const tags = ['Catalogue'];
  api.get(
    '/products',
    {
      schema: {
        tags,
        querystring: productQuery,
        response: { 200: productListDto, ...errorResponses },
      },
    },
    async (request, reply) => {
      const result = await service.list(request.query);
      reply.header('cache-control', 'public, max-age=30, s-maxage=30');
      return result;
    },
  );
  api.get(
    '/products/:id',
    {
      schema: {
        tags,
        params: idParams,
        querystring: emptyQuery,
        response: { 200: productDto, ...errorResponses },
      },
    },
    async (request, reply) => {
      const result = productView(await service.product(request.params.id));
      reply.header('cache-control', 'public, max-age=30, s-maxage=30');
      return result;
    },
  );
  api.get(
    '/products/:id/related',
    {
      schema: {
        tags,
        params: idParams,
        querystring: emptyQuery,
        response: { 200: relatedDto, ...errorResponses },
      },
    },
    async (request, reply) => {
      const result = await service.related(request.params.id);
      reply.header('cache-control', 'public, max-age=30, s-maxage=30');
      return result;
    },
  );
  api.get(
    '/products/:id/reviews',
    {
      schema: {
        tags,
        params: idParams,
        querystring: pagination,
        response: { 200: publicReviewsDto, ...errorResponses },
      },
    },
    async (request, reply) => {
      const result = await service.publicReviews(
        request.params.id,
        request.query,
      );
      reply.header('cache-control', 'public, max-age=30, s-maxage=30');
      return result;
    },
  );
  api.get(
    '/categories',
    {
      schema: {
        tags,
        querystring: emptyQuery,
        response: { 200: categoryListDto, ...errorResponses },
      },
    },
    async (_request, reply) => {
      const result = await service.categories();
      reply.header('cache-control', 'public, max-age=30, s-maxage=30');
      return result;
    },
  );
}
