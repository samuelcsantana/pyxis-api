import type { FastifyInstance } from 'fastify';

const TEXT_PLAIN = 'text/plain';
const BAD_REQUEST = 400;

export class InvalidJsonBodyError extends Error {
  readonly statusCode = BAD_REQUEST;

  constructor() {
    super('The request body is not valid JSON.');
    this.name = 'InvalidJsonBodyError';
  }
}

export function parseJsonText(body: string): unknown {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new InvalidJsonBodyError();
  }
}

export function registerJsonTextParser(fastify: FastifyInstance): void {
  fastify.removeContentTypeParser(TEXT_PLAIN);
  fastify.addContentTypeParser(TEXT_PLAIN, { parseAs: 'string' }, (_request, body, done) => {
    try {
      done(null, parseJsonText(String(body)));
    } catch (error) {
      done(error as InvalidJsonBodyError, undefined);
    }
  });
}
