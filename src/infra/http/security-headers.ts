import type { FastifyInstance } from 'fastify';

export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
};

export const DEFAULT_CACHE_CONTROL = 'no-store';

export function registerSecurityHeaders(fastify: FastifyInstance): void {
  fastify.addHook('onSend', async (_request, reply, payload) => {
    reply.headers(SECURITY_HEADERS);
    if (!reply.hasHeader('Cache-Control')) {
      reply.header('Cache-Control', DEFAULT_CACHE_CONTROL);
    }
    return payload;
  });
}
