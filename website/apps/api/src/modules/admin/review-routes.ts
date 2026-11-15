import type { FastifyInstance } from 'fastify';
import {
  adminReviewList,
  adminReviewsQuery,
  idParams,
} from '@storefront/shared';
import { apiRoute, errorResponses } from '../../plugins/route.js';
import type { AuthService } from '../auth/service.js';
import type { ReviewService } from '../reviews/service.js';
import type { AdminReviews } from './reviews.js';
import {
  adminSchema,
  adminWrite,
  audit,
  deletedDto,
} from './product-routes.js';

export async function adminReviewRoutes(
  app: FastifyInstance,
  service: AdminReviews,
  reviews: ReviewService,
  auth: AuthService,
) {
  const api = apiRoute(app);
  const preHandler = auth.requireAdmin;
  api.get(
    '/admin/reviews',
    {
      preHandler,
      schema: {
        ...adminSchema,
        querystring: adminReviewsQuery,
        response: { 200: adminReviewList, ...errorResponses },
      },
    },
    (request) => service.list(request.query),
  );
  api.delete(
    '/admin/reviews/:id',
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
      await reviews.removeAdmin(request.params.id);
      audit(request, 'review.delete', request.params.id);
      return { deleted: true as const };
    },
  );
}
