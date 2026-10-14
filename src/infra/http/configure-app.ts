import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { registerDashboardCors } from './auth/dashboard-cors';
import { registerBillingWebhookBodyLimit } from './billing/billing-webhook-body-limit';
import { HttpErrorFilter } from './errors/http-error.filter';
import { registerJsonTextParser } from './json-text-parser';
import { registerRequestId } from './request-id';
import { registerSecurityHeaders } from './security-headers';

export interface AppSettings {
  readonly dashboardOrigin?: string;
}

export function configureApp(app: NestFastifyApplication, settings: AppSettings = {}): void {
  const fastify = app.getHttpAdapter().getInstance();
  registerSecurityHeaders(fastify);
  registerRequestId(fastify);
  registerDashboardCors(fastify, settings.dashboardOrigin);
  registerJsonTextParser(fastify);
  registerBillingWebhookBodyLimit(fastify);
  app.useGlobalFilters(new HttpErrorFilter());
}
