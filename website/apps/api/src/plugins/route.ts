import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import { errorResponseSchema } from '@storefront/shared';

export function apiRoute(app: FastifyInstance) {
  return app.withTypeProvider<ZodTypeProvider>();
}
export const errorResponses = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
  413: errorResponseSchema,
  415: errorResponseSchema,
  429: errorResponseSchema,
  500: errorResponseSchema,
  503: errorResponseSchema,
};

export function rawJson(app: FastifyInstance) {
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_request, body, done) => {
      try {
        done(
          null,
          new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
            body as Buffer,
          ),
        );
      } catch {
        done(Object.assign(new Error('Invalid UTF-8'), { statusCode: 400 }));
      }
    },
  );
}
