import { z } from 'zod';

const contract: Record<string, string[]> = {
  GET: [
    '/products',
    '/products/{id}',
    '/products/{id}/related',
    '/products/{id}/reviews',
    '/categories',
    '/me',
    '/cart',
    '/wishlist',
    '/addresses',
    '/checkout/sessions/{id}',
    '/orders',
    '/orders/{id}',
    '/notifications',
  ],
  PATCH: [
    '/me',
    '/cart/items/{productId}',
    '/addresses/{id}',
    '/reviews/{id}',
    '/notifications/{id}/read',
  ],
  POST: [
    '/cart/items',
    '/addresses',
    '/checkout/quote',
    '/checkout/sessions',
    '/reviews',
    '/notifications/read-all',
  ],
  PUT: ['/wishlist/{productId}'],
  DELETE: [
    '/cart',
    '/cart/items/{productId}',
    '/wishlist/{productId}',
    '/addresses/{id}',
    '/reviews/{id}',
  ],
};
const specSchema = z.object({
  paths: z.record(z.string(), z.record(z.string(), z.unknown())),
});
const operationSchema = z.object({
  responses: z.record(z.string(), z.unknown()),
});

export function verifyOpenApi(document: unknown) {
  const { paths } = specSchema.parse(document);
  for (const [method, routes] of Object.entries(contract)) {
    for (const route of routes) {
      const path = '/api/v1' + route;
      const status = method === 'POST' && route === '/reviews' ? '201' : '200';
      const entry = operationSchema.safeParse(
        paths[path]?.[method.toLowerCase()],
      );
      if (!entry.success || !(status in entry.data.responses)) {
        throw new Error(`OpenAPI missing ${method} ${path} (${status})`);
      }
    }
  }
  return Object.values(contract).flat().length;
}
