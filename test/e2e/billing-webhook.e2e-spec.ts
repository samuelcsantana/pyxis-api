import { Logger } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import postgres from 'postgres';
import Stripe from 'stripe';
import { BILLING_GATEWAY } from '../../src/domain/billing/billing-gateway';
import { MAIL_SENDER } from '../../src/domain/services/mail-sender';
import { StripeBillingGateway } from '../../src/infra/billing/stripe-billing-gateway';
import { RecordingMailSender } from '../../src/test-utils/recording-mail-sender';
import { fakeStripe } from '../../src/test-utils/stripe-fake-http';
import { createTestApp } from './create-test-app';
import { e2eOwnerUrl } from './e2e-database';

const WEBHOOK_SECRET = 'whsec_e2e_secret';
const OWNER_ID = 'd9d8d7d6-0000-4000-8000-000000000001';
const ACCOUNT_ID = 'd9d8d7d6-0000-4000-8000-000000000011';
const SECOND_ACCOUNT_ID = 'd9d8d7d6-0000-4000-8000-000000000012';
const CARD_FINGERPRINT = 'fp_e2e_card';
const TRIAL_END_SECONDS = 1_793_000_000;
const WEBHOOK = '/v1/billing/stripe/webhook';

function subscription(status: string, accountId = ACCOUNT_ID): object {
  return {
    id: 'sub_e2e',
    object: 'subscription',
    customer: 'cus_e2e',
    status,
    metadata: { account_id: accountId },
    default_payment_method: {
      id: 'pm_e2e',
      object: 'payment_method',
      card: { fingerprint: CARD_FINGERPRINT },
    },
    trial_end: TRIAL_END_SECONDS,
    cancel_at: null,
    cancel_at_period_end: false,
    items: {
      object: 'list',
      data: [{ current_period_end: TRIAL_END_SECONDS, price: { recurring: { interval: 'year' } } }],
    },
  };
}

function signedEvent(id: string, type: string, object: object) {
  const payload = JSON.stringify({ id, object: 'event', type, data: { object } });
  return {
    payload,
    signature: Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET }),
  };
}

describe('POST /v1/billing/stripe/webhook', () => {
  let app: NestFastifyApplication;
  let owner: postgres.Sql;
  const stripe = fakeStripe();
  const mail = new RecordingMailSender();

  const deliver = (payload: string, signature: string | null, contentType = 'application/json') =>
    app.inject({
      method: 'POST',
      url: WEBHOOK,
      payload,
      headers: {
        'content-type': contentType,
        ...(signature === null ? {} : { 'stripe-signature': signature }),
      },
    });

  beforeAll(async () => {
    owner = postgres(e2eOwnerUrl(), { max: 1, onnotice: () => undefined });
    await owner`INSERT INTO admin_users (id, email) VALUES (${OWNER_ID}, 'billing-owner@example.com')`;
    await owner`
      INSERT INTO accounts (id, owner_admin_id, status)
      VALUES (${ACCOUNT_ID}, ${OWNER_ID}, 'incomplete'), (${SECOND_ACCOUNT_ID}, ${OWNER_ID}, 'incomplete')
    `;
    app = await createTestApp((builder) =>
      builder
        .overrideProvider(BILLING_GATEWAY)
        .useValue(new StripeBillingGateway(stripe.stripe, WEBHOOK_SECRET))
        .overrideProvider(MAIL_SENDER)
        .useValue(mail),
    );
  });

  afterAll(async () => {
    await app.close();
    await owner`DELETE FROM trial_cards WHERE fingerprint = ${CARD_FINGERPRINT}`;
    await owner`DELETE FROM accounts WHERE id IN (${ACCOUNT_ID}, ${SECOND_ACCOUNT_ID})`;
    await owner`DELETE FROM admin_users WHERE id = ${OWNER_ID}`;
    await owner.end();
  });

  it('turns a completed Checkout into a trialing account, reading the subscription from Stripe', async () => {
    stripe.answer('GET', '/v1/subscriptions/sub_e2e', { body: subscription('trialing') });
    const { payload, signature } = signedEvent('evt_e2e_1', 'checkout.session.completed', {
      object: 'checkout.session',
      subscription: 'sub_e2e',
      customer: 'cus_e2e',
      client_reference_id: ACCOUNT_ID,
    });

    const response = await deliver(payload, signature);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ received: 'applied' });
    const [account] = await owner<
      {
        status: string;
        stripe_customer_id: string;
        billing_interval: string;
        trial_ends_at: Date;
      }[]
    >`
      SELECT status, stripe_customer_id, billing_interval, trial_ends_at FROM accounts
      WHERE id = ${ACCOUNT_ID}
    `;
    expect(account).toEqual({
      status: 'trialing',
      stripe_customer_id: 'cus_e2e',
      billing_interval: 'year',
      trial_ends_at: new Date(TRIAL_END_SECONDS * 1000),
    });
    expect(mail.welcomes).toEqual([
      {
        email: 'billing-owner@example.com',
        welcome: {
          plan: { kind: 'trial', trialEndsAt: new Date(TRIAL_END_SECONDS * 1000) },
          terms: null,
        },
        language: 'en',
      },
    ]);
    const [welcomed] = await owner<{ welcomed: boolean }[]>`
      SELECT welcomed_at IS NOT NULL AS welcomed FROM accounts WHERE id = ${ACCOUNT_ID}
    `;
    expect(welcomed).toEqual({ welcomed: true });
  });

  it('answers a resent event as a duplicate and changes nothing', async () => {
    stripe.answer('GET', '/v1/subscriptions/sub_e2e', { body: subscription('canceled') });
    const { payload, signature } = signedEvent('evt_e2e_1', 'checkout.session.completed', {
      object: 'checkout.session',
      subscription: 'sub_e2e',
      customer: 'cus_e2e',
      client_reference_id: ACCOUNT_ID,
    });

    const response = await deliver(payload, signature);

    expect(response.json()).toEqual({ received: 'duplicate' });
    const [account] = await owner<{ status: string }[]>`
      SELECT status FROM accounts WHERE id = ${ACCOUNT_ID}
    `;
    expect(account?.status).toBe('trialing');
  });

  it('refuses an event without a valid signature', async () => {
    const { payload } = signedEvent('evt_e2e_2', 'invoice.paid', {});

    const unsigned = await deliver(payload, null);
    const forged = await deliver(payload, 't=1,v1=forged');

    expect(unsigned.statusCode).toBe(400);
    expect(forged.statusCode).toBe(400);
    expect(forged.json()).toMatchObject({ error: 'invalid_billing_signature' });
  });

  it('answers 503 when Stripe cannot be read, so Stripe sends the event again', async () => {
    const { payload, signature } = signedEvent('evt_e2e_3', 'customer.subscription.updated', {
      ...subscription('active'),
      id: 'sub_unknown',
    });

    const response = await deliver(payload, signature);

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ error: 'billing_unavailable' });
  });

  it('refuses a body that is not JSON', async () => {
    const response = await deliver('{"id":"evt"}', 't=1,v1=x', 'text/plain');

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'invalid_request' });
  });

  it('takes an event larger than the batch limit', async () => {
    stripe.answer('GET', '/v1/subscriptions/sub_e2e', { body: subscription('active') });
    const { payload, signature } = signedEvent('evt_e2e_4', 'invoice.paid', {
      object: 'invoice',
      customer: 'cus_e2e',
      parent: { subscription_details: { subscription: 'sub_e2e' } },
      lines: {
        data: Array.from({ length: 1000 }, (_, index) => ({
          id: `il_${String(index)}`,
          description: 'Pyxis yearly plan',
        })),
      },
    });

    const response = await deliver(payload, signature);

    expect(payload.length).toBeGreaterThan(32_768);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ received: 'applied' });
  });

  it('records the card of each trial and warns when a second account starts one with it', async () => {
    const warnings: unknown[] = [];
    jest.spyOn(Logger.prototype, 'warn').mockImplementation((message: unknown) => {
      warnings.push(message);
    });
    stripe.answer('GET', '/v1/subscriptions/sub_e2e_again', {
      body: {
        ...subscription('trialing', SECOND_ACCOUNT_ID),
        id: 'sub_e2e_again',
        customer: 'cus_e2e_again',
      },
    });
    const { payload, signature } = signedEvent('evt_e2e_5', 'checkout.session.completed', {
      object: 'checkout.session',
      subscription: 'sub_e2e_again',
      customer: 'cus_e2e_again',
      client_reference_id: SECOND_ACCOUNT_ID,
    });

    const response = await deliver(payload, signature);

    expect(response.json()).toEqual({ received: 'applied' });
    const cards = await owner<{ account_id: string }[]>`
      SELECT account_id FROM trial_cards WHERE fingerprint = ${CARD_FINGERPRINT}
      ORDER BY trial_started_at
    `;
    expect(cards).toEqual([{ account_id: ACCOUNT_ID }, { account_id: SECOND_ACCOUNT_ID }]);
    expect(warnings).toContainEqual({
      message: 'billing.repeated_trial',
      accountId: SECOND_ACCOUNT_ID,
      earlierAccountIds: [ACCOUNT_ID],
    });
    jest.restoreAllMocks();
  });
});
