import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { HttpErrorFilter } from './errors/http-error.filter';
import { registerJsonTextParser } from './json-text-parser';
import { registerRequestId } from './request-id';
import { registerSecurityHeaders } from './security-headers';

export function configureApp(app: NestFastifyApplication): void {
  const fastify = app.getHttpAdapter().getInstance();
  registerSecurityHeaders(fastify);
  registerRequestId(fastify);
  registerJsonTextParser(fastify);
  app.useGlobalFilters(new HttpErrorFilter());
}
