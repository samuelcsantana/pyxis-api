import type { RawBodyRequest } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { singleHeader } from '../request-headers';

export const FORWARDED_HEADERS = [
  'accept',
  'content-type',
  'origin',
  'mcp-protocol-version',
  'mcp-session-id',
  'last-event-id',
] as const;

const BODYLESS_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD']);

function bodyOf(request: RawBodyRequest<FastifyRequest>): string | undefined {
  if (BODYLESS_METHODS.has(request.method)) {
    return undefined;
  }
  return request.rawBody?.toString('utf8');
}

export function webRequestOf(request: RawBodyRequest<FastifyRequest>, apiOrigin: string): Request {
  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = singleHeader(request, name);
    if (value !== undefined) {
      headers.set(name, value);
    }
  }
  return new Request(`${apiOrigin}${request.url}`, {
    method: request.method,
    headers,
    body: bodyOf(request),
  });
}

export async function sendWebResponse(reply: FastifyReply, response: Response): Promise<void> {
  const body = await response.text();
  response.headers.forEach((value, name) => {
    void reply.header(name, value);
  });
  await reply.status(response.status).send(body);
}
