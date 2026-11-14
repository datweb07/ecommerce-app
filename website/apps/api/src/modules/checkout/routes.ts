import type { FastifyInstance } from 'fastify';
import {
  acknowledgement,
  emptyQuery,
  idParams,
  pagination,
  rawWebhookBody,
} from '@storefront/shared';
import {
  apiRoute,
  bearerSecurity,
  errorResponses,
  rawJson,
} from '../../plugins/route.js';
import type { AuthService } from '../auth/service.js';
import type { CheckoutService } from './service.js';
import type { OrderService } from './orders.js';
import {
  checkoutHeaders,
  checkoutInput,
  checkoutQuote,
  checkoutStatus,
  orderDto,
  orderListDto,
  stripeHeaders,
} from './schemas.js';

export async function checkoutRoutes(
  app: FastifyInstance,
  checkout: CheckoutService,
  orders: OrderService,
  auth: AuthService,
) {
  const api = apiRoute(app);
  const tags = ['Checkout'];
  const preHandler = auth.requireAuth;
  api.post(
    '/checkout/quote',
    {
      preHandler,
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: {
        tags,
        security: bearerSecurity,
        querystring: emptyQuery,
        body: checkoutInput,
        response: { 200: checkoutQuote, ...errorResponses },
      },
    },
    async (request) => checkout.quote(request.storefrontUser, request.body),
  );
  api.post(
    '/checkout/sessions',
    {
      preHandler,
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        tags,
        security: bearerSecurity,
        querystring: emptyQuery,
        headers: checkoutHeaders,
        body: checkoutInput,
        response: { 200: checkoutStatus, ...errorResponses },
      },
    },
    async (request) =>
      checkout.create(
        request.storefrontUser,
        request.body,
        request.headers['idempotency-key'],
      ),
  );
  api.get(
    '/checkout/sessions/:id',
    {
      preHandler,
      schema: {
        tags,
        security: bearerSecurity,
        params: idParams,
        querystring: emptyQuery,
        response: { 200: checkoutStatus, ...errorResponses },
      },
    },
    async (request) => checkout.get(request.storefrontUser, request.params.id),
  );
  api.get(
    '/orders',
    {
      preHandler,
      schema: {
        tags: ['Orders'],
        security: bearerSecurity,
        querystring: pagination,
        response: { 200: orderListDto, ...errorResponses },
      },
    },
    async (request) => orders.list(request.storefrontUser, request.query),
  );
  api.get(
    '/orders/:id',
    {
      preHandler,
      schema: {
        tags: ['Orders'],
        security: bearerSecurity,
        querystring: emptyQuery,
        params: idParams,
        response: { 200: orderDto, ...errorResponses },
      },
    },
    async (request) => orders.get(request.storefrontUser, request.params.id),
  );
  await app.register(async (scope) => {
    rawJson(scope);
    apiRoute(scope).post(
      '/webhooks/stripe',
      {
        config: { rateLimit: false },
        schema: {
          tags: ['Webhooks'],
          querystring: emptyQuery,
          headers: stripeHeaders,
          body: rawWebhookBody,
          response: { 200: acknowledgement, ...errorResponses },
        },
      },
      async (request) => {
        await checkout.receive(
          request.body,
          request.headers['stripe-signature'],
        );
        return { received: true as const };
      },
    );
  });
}
