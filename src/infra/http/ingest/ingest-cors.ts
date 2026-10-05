import type { FastifyReply } from 'fastify';

export const PREFLIGHT_MAX_AGE_SECONDS = 86_400;

export function allowOrigin(reply: FastifyReply, origin: string): void {
  void reply.header('access-control-allow-origin', origin).header('vary', 'Origin');
}

export function answerPreflight(reply: FastifyReply, origin: string | undefined): void {
  void reply.header('vary', 'Origin');
  if (origin === undefined) {
    return;
  }
  void reply
    .header('access-control-allow-origin', origin)
    .header('access-control-allow-methods', 'POST')
    .header('access-control-allow-headers', 'Content-Type')
    .header('access-control-max-age', String(PREFLIGHT_MAX_AGE_SECONDS));
}
