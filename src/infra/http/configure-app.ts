import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { registerRequestId } from './request-id';
import { registerSecurityHeaders } from './security-headers';

export function configureApp(app: NestFastifyApplication): void {
  const fastify = app.getHttpAdapter().getInstance();
  registerSecurityHeaders(fastify);
  registerRequestId(fastify);
}
