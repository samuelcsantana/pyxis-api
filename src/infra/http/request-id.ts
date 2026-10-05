import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';

export const REQUEST_ID_HEADER = 'X-Request-Id';

declare module 'fastify' {
  interface FastifyRequest {
    requestId: string;
  }
}

export function registerRequestId(fastify: FastifyInstance): void {
  fastify.decorateRequest('requestId', '');
  fastify.addHook('onRequest', async (request, reply) => {
    request.requestId = randomUUID();
    reply.header(REQUEST_ID_HEADER, request.requestId);
  });
}
