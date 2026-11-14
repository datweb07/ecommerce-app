import type { FastifyInstance } from 'fastify';
import {
  apiRoute,
  bearerSecurity,
  errorResponses,
} from '../../plugins/route.js';
import type { AuthService } from '../auth/service.js';
import type { CustomerService } from './service.js';
import {
  acknowledgement,
  addressCreate,
  addressListDto,
  addressPatch,
  cartAdd,
  cartDto,
  cartPatch,
  emptyQuery,
  idParams,
  pagination,
  productIdParams,
  productListDto,
} from './schemas.js';

export async function customerRoutes(
  app: FastifyInstance,
  service: CustomerService,
  auth: AuthService,
) {
  const api = apiRoute(app);
  const preHandler = auth.requireAuth;
  const cart = {
    tags: ['Cart'],
    security: bearerSecurity,
    querystring: emptyQuery,
    response: { 200: cartDto, ...errorResponses },
  };
  api.get('/cart', { preHandler, schema: cart }, async (r) =>
    service.viewCart(r.storefrontUser),
  );
  api.post(
    '/cart/items',
    { preHandler, schema: { ...cart, body: cartAdd } },
    async (r) =>
      service.changeCart(r.storefrontUser, { action: 'add', ...r.body }),
  );
  api.patch(
    '/cart/items/:productId',
    {
      preHandler,
      schema: { ...cart, params: productIdParams, body: cartPatch },
    },
    async (r) =>
      service.changeCart(r.storefrontUser, {
        action: 'set',
        ...r.params,
        ...r.body,
      }),
  );
  api.delete(
    '/cart/items/:productId',
    { preHandler, schema: { ...cart, params: productIdParams } },
    async (r) =>
      service.changeCart(r.storefrontUser, { action: 'remove', ...r.params }),
  );
  api.delete('/cart', { preHandler, schema: cart }, async (r) =>
    service.changeCart(r.storefrontUser, { action: 'clear' }),
  );
  api.get(
    '/wishlist',
    {
      preHandler,
      schema: {
        tags: ['Wishlist'],
        security: bearerSecurity,
        querystring: pagination,
        response: { 200: productListDto, ...errorResponses },
      },
    },
    async (r) => service.wishlist(r.storefrontUser, r.query),
  );
  const wish = {
    tags: ['Wishlist'],
    security: bearerSecurity,
    querystring: emptyQuery,
    params: productIdParams,
    response: { 200: acknowledgement, ...errorResponses },
  };
  api.put('/wishlist/:productId', { preHandler, schema: wish }, async (r) =>
    service.setWish(r.storefrontUser, r.params.productId, true),
  );
  api.delete('/wishlist/:productId', { preHandler, schema: wish }, async (r) =>
    service.setWish(r.storefrontUser, r.params.productId, false),
  );
  const address = {
    tags: ['Addresses'],
    security: bearerSecurity,
    querystring: emptyQuery,
    response: { 200: addressListDto, ...errorResponses },
  };
  api.get('/addresses', { preHandler, schema: address }, async (r) =>
    service.addresses(r.storefrontUser),
  );
  api.post(
    '/addresses',
    { preHandler, schema: { ...address, body: addressCreate } },
    async (r) =>
      service.changeAddress(r.storefrontUser, {
        action: 'create',
        input: r.body,
      }),
  );
  api.patch(
    '/addresses/:id',
    {
      preHandler,
      schema: { ...address, params: idParams, body: addressPatch },
    },
    async (r) =>
      service.changeAddress(r.storefrontUser, {
        action: 'update',
        id: r.params.id,
        input: r.body,
      }),
  );
  api.delete(
    '/addresses/:id',
    { preHandler, schema: { ...address, params: idParams } },
    async (r) =>
      service.changeAddress(r.storefrontUser, {
        action: 'delete',
        id: r.params.id,
      }),
  );
}
