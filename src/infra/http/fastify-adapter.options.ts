import { FastifyAdapter } from '@nestjs/platform-fastify';
import { MAX_BATCH_BYTES } from '../../domain/events/event-limits';

export function createFastifyAdapter(): FastifyAdapter {
  return new FastifyAdapter({ trustProxy: false, bodyLimit: MAX_BATCH_BYTES });
}
