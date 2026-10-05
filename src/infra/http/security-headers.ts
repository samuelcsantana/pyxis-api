import type { FastifyInstance } from 'fastify';
import { SWAGGER_UI_PATH } from './openapi/swagger-ui';

export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
};

export const DEFAULT_CACHE_CONTROL = 'no-store';

const HEADERS_FOR_SWAGGER_UI = Object.fromEntries(
  Object.entries(SECURITY_HEADERS).filter(([name]) => name !== 'Content-Security-Policy'),
);

function isSwaggerUi(url: string): boolean {
  return url.startsWith(`/${SWAGGER_UI_PATH}`);
}

export function registerSecurityHeaders(fastify: FastifyInstance): void {
  fastify.addHook('onSend', async (request, reply, payload) => {
    reply.headers(isSwaggerUi(request.url) ? HEADERS_FOR_SWAGGER_UI : SECURITY_HEADERS);
    if (!reply.hasHeader('Cache-Control')) {
      reply.header('Cache-Control', DEFAULT_CACHE_CONTROL);
    }
    return payload;
  });
}
