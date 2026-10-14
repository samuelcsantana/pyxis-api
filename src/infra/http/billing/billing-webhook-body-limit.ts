import type { FastifyInstance } from 'fastify';
import { BILLING_WEBHOOK_PATH } from './billing-webhook.controller';

export const BILLING_WEBHOOK_BODY_LIMIT = 512 * 1024;

export function registerBillingWebhookBodyLimit(fastify: FastifyInstance): void {
  fastify.addHook('onRoute', (route) => {
    if (route.url === BILLING_WEBHOOK_PATH) {
      route.bodyLimit = BILLING_WEBHOOK_BODY_LIMIT;
    }
  });
}
