import { FastifyAdapter } from '@nestjs/platform-fastify';

export function createFastifyAdapter(): FastifyAdapter {
  return new FastifyAdapter({ trustProxy: false });
}
