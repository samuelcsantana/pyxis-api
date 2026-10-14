import type { FastifyInstance, RouteOptions } from 'fastify';
import { BILLING_WEBHOOK_PATH } from './billing-webhook.controller';
import {
  BILLING_WEBHOOK_BODY_LIMIT,
  registerBillingWebhookBodyLimit,
} from './billing-webhook-body-limit';

describe('registerBillingWebhookBodyLimit', () => {
  it('lets only the billing webhook take bodies past the batch limit', () => {
    const hooks: ((route: RouteOptions) => void)[] = [];
    const fastify = {
      addHook: (name: string, hook: (route: RouteOptions) => void) => {
        expect(name).toBe('onRoute');
        hooks.push(hook);
      },
    } as unknown as FastifyInstance;
    const webhook = { url: BILLING_WEBHOOK_PATH } as RouteOptions;
    const batch = { url: '/v1/batch' } as RouteOptions;

    registerBillingWebhookBodyLimit(fastify);
    for (const hook of hooks) {
      hook(webhook);
      hook(batch);
    }

    expect(webhook.bodyLimit).toBe(BILLING_WEBHOOK_BODY_LIMIT);
    expect(batch.bodyLimit).toBeUndefined();
  });
});
