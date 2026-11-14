import type { FastifyInstance } from 'fastify';
import { acknowledgement, emptyQuery } from '@storefront/shared';
import {
  apiRoute,
  bearerSecurity,
  errorResponses,
} from '../../plugins/route.js';
import type { AuthService } from '../auth/service.js';
import {
  idParams,
  ownReviewDto,
  reviewCreate,
  reviewPatch,
} from './schemas.js';
import type { ReviewService } from './service.js';

export async function reviewRoutes(
  app: FastifyInstance,
  service: ReviewService,
  auth: AuthService,
) {
  const api = apiRoute(app);
  const schema = {
    tags: ['Reviews'],
    security: bearerSecurity,
    querystring: emptyQuery,
  };
  const guard = {
    preHandler: auth.requireAuth,
    config: { rateLimit: { max: 15, timeWindow: '1 minute' } },
  };
  api.post(
    '/reviews',
    {
      ...guard,
      schema: {
        ...schema,
        body: reviewCreate,
        response: { 201: ownReviewDto, ...errorResponses },
      },
    },
    async (request, reply) =>
      reply
        .code(201)
        .send(await service.create(request.storefrontUser, request.body)),
  );
  api.patch(
    '/reviews/:id',
    {
      ...guard,
      schema: {
        ...schema,
        params: idParams,
        body: reviewPatch,
        response: { 200: ownReviewDto, ...errorResponses },
      },
    },
    async (request) =>
      service.update(
        request.storefrontUser,
        request.params.id,
        request.body.rating,
      ),
  );
  api.delete(
    '/reviews/:id',
    {
      ...guard,
      schema: {
        ...schema,
        params: idParams,
        response: { 200: acknowledgement, ...errorResponses },
      },
    },
    async (request) => {
      await service.remove(request.storefrontUser, request.params.id);
      return { received: true as const };
    },
  );
}
