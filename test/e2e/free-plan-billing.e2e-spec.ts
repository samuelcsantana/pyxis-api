import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import postgres from 'postgres';
import Stripe from 'stripe';
import { SIGN_UP_SETTINGS } from '../../src/domain/accounts/sign-up-settings';
import { sha256Hex } from '../../src/domain/auth/hashing';
import { BILLING_GATEWAY } from '../../src/domain/billing/billing-gateway';
import { CLOCK } from '../../src/domain/services/clock';
import { MAIL_SENDER } from '../../src/domain/services/mail-sender';
import { StripeBillingGateway } from '../../src/infra/billing/stripe-billing-gateway';
import { SESSION_COOKIE_NAME } from '../../src/infra/http/auth/session-cookie';
import { FixedClock } from '../../src/test-utils/fixed-clock';
import { RecordingMailSender } from '../../src/test-utils/recording-mail-sender';
import { fakeStripe } from '../../src/test-utils/stripe-fake-http';
import { createTestApp } from './create-test-app';
import { e2eOwnerUrl } from './e2e-database';
import { E2E_DASHBOARD_ORIGIN } from './env-setup';

const NOW = new Date('2026-11-20T15:00:00.000Z');
const NOW_SECONDS = NOW.getTime() / 1000;
const DAY_SECONDS = 24 * 60 * 60;
const WEBHOOK_SECRET = 'whsec_free_plan_e2e';
const OWNER_ID = '7b8c9d0e-1f2a-4b3c-8d4e-5f6a7b8c9d01';
const ACCOUNT_ID = '7b8c9d0e-1f2a-4b3c-8d4e-5f6a7b8c9d11';
const OWNER_EMAIL = 'free-plan-owner@example.com';
const OWNER_SESSION = 'e2e-free-plan-owner-session';
const SUBSCRIPTION = 'sub_free_plan_e2e';
const CUSTOMER = 'cus_free_plan_e2e';
const EVENT_IDS = ['evt_free_plan_e2e_paid', 'evt_free_plan_e2e_deleted'];
const PROJECT_IDS = [
  '7b8c9d0e-1f2a-4b3c-8d4e-5f6a7b8c9d21',
  '7b8c9d0e-1f2a-4b3c-8d4e-5f6a7b8c9d22',
];
const FIT_BY = new Date(NOW.getTime() + 30 * DAY_SECONDS * 1000);

function subscription(status: string): object {
  return {
    id: SUBSCRIPTION,
    object: 'subscription',
    customer: CUSTOMER,
    status,
    metadata: { account_id: ACCOUNT_ID },
    trial_end: null,
    cancel_at: null,
    cancel_at_period_end: false,
    items: {
      object: 'list',
      data: [
        {
          current_period_end: NOW_SECONDS + 30 * DAY_SECONDS,
          price: { recurring: { interval: 'month' } },
        },
      ],
    },
  };
}

describe('the free plan and billing over HTTP', () => {
  let app: NestFastifyApplication;
  let owner: postgres.Sql;
  const stripe = fakeStripe();
  const mail = new RecordingMailSender();

  const webhook = (id: string, type: string, status: string) => {
    stripe.answer('GET', `/v1/subscriptions/${SUBSCRIPTION}`, { body: subscription(status) });
    const payload = JSON.stringify({
      id,
      object: 'event',
      type,
      data: { object: subscription(status) },
    });
    return app.inject({
      method: 'POST',
      url: '/v1/billing/stripe/webhook',
      payload,
      headers: {
        'content-type': 'application/json',
        'stripe-signature': Stripe.webhooks.generateTestHeaderString({
          payload,
          secret: WEBHOOK_SECRET,
        }),
      },
    });
  };

  const accountRow = async () => {
    const [row] = await owner<
      {
        status: string;
        stripe_customer_id: string | null;
        stripe_subscription_id: string | null;
        ingestion_paused_until: Date | null;
        subscription_confirmation_due_at: Date | null;
      }[]
    >`
      SELECT status, stripe_customer_id, stripe_subscription_id, ingestion_paused_until,
             subscription_confirmation_due_at
      FROM accounts WHERE id = ${ACCOUNT_ID}
    `;
    return row;
  };

  beforeAll(async () => {
    owner = postgres(e2eOwnerUrl(), { max: 1, onnotice: () => undefined });
    await owner`
      INSERT INTO admin_users (id, email, email_language) VALUES (${OWNER_ID}, ${OWNER_EMAIL}, 'pt-BR')
    `;
    await owner`
      INSERT INTO accounts (id, owner_admin_id, status, ingestion_paused_until)
      VALUES (${ACCOUNT_ID}, ${OWNER_ID}, 'free', '2026-12-01T00:00:00Z')
    `;
    await owner`
      INSERT INTO account_usage_months (account_id, month, events, notified_level, updated_at)
      VALUES (${ACCOUNT_ID}, '2026-11', 10200, 150, ${NOW})
    `;
    await owner`
      INSERT INTO terms_acceptances (admin_user_id, account_id, version, accepted_at)
      VALUES (${OWNER_ID}, ${ACCOUNT_ID}, '1.3', ${NOW})
    `;
    await owner`
      INSERT INTO admin_sessions (admin_user_id, token_hash, created_at, last_used_at)
      VALUES (${OWNER_ID}, ${sha256Hex(OWNER_SESSION)}, ${NOW}, ${NOW})
    `;
    app = await createTestApp((builder) =>
      builder
        .overrideProvider(CLOCK)
        .useValue(new FixedClock(NOW))
        .overrideProvider(BILLING_GATEWAY)
        .useValue(new StripeBillingGateway(stripe.stripe, WEBHOOK_SECRET))
        .overrideProvider(MAIL_SENDER)
        .useValue(mail)
        .overrideProvider(SIGN_UP_SETTINGS)
        .useValue({
          open: true,
          termsVersion: '1.3',
          termsUrl: 'https://pyxis.example.com/terms',
          dashboardOrigin: E2E_DASHBOARD_ORIGIN,
          freePlanOpen: true,
          freeAccountsMax: 200,
          trialOffered: false,
          freePlanTermsForEarlierAccountsFrom: null,
        }),
    );
  });

  afterAll(async () => {
    await app.close();
    await owner`DELETE FROM projects WHERE account_id = ${ACCOUNT_ID}`;
    await owner`DELETE FROM accounts WHERE id = ${ACCOUNT_ID}`;
    await owner`DELETE FROM admin_sessions WHERE admin_user_id = ${OWNER_ID}`;
    await owner`DELETE FROM admin_users WHERE id = ${OWNER_ID}`;
    await owner`DELETE FROM billing_events WHERE id IN ${owner(EVENT_IDS)}`;
    await owner.end();
  });

  it('moves a paused free account onto the paid plan, lifting the pause and confirming once', async () => {
    const paid = await webhook(EVENT_IDS[0] ?? '', 'customer.subscription.created', 'active');

    expect(paid.statusCode).toBe(200);
    expect(paid.json()).toEqual({ received: 'applied' });
    expect(await accountRow()).toEqual({
      status: 'active',
      stripe_customer_id: CUSTOMER,
      stripe_subscription_id: SUBSCRIPTION,
      ingestion_paused_until: null,
      subscription_confirmation_due_at: null,
    });
    const [usage] = await owner<{ notified_level: number }[]>`
      SELECT notified_level FROM account_usage_months WHERE account_id = ${ACCOUNT_ID}
    `;
    expect(usage).toEqual({ notified_level: 0 });
    expect(mail.subscriptionConfirmations).toEqual([
      {
        email: OWNER_EMAIL,
        confirmation: {
          interval: 'month',
          withdrawalDays: 7,
          terms: { version: '1.3', url: 'https://pyxis.example.com/terms' },
        },
        language: 'pt-BR',
      },
    ]);
  });

  it('withdraws within 7 days: cancels, refunds and goes back to free, with 30 days to fit', async () => {
    for (const projectId of PROJECT_IDS) {
      await owner`INSERT INTO projects (id, name, account_id) VALUES (${projectId}, 'Site', ${ACCOUNT_ID})`;
    }
    stripe.requests.length = 0;
    stripe.answer('GET', '/v1/invoices', {
      body: {
        object: 'list',
        data: [
          {
            id: 'in_free_plan_1',
            object: 'invoice',
            amount_paid: 3900,
            status_transitions: { paid_at: NOW_SECONDS - 2 * DAY_SECONDS },
          },
        ],
      },
    });
    stripe.answer('DELETE', `/v1/subscriptions/${SUBSCRIPTION}`, {
      body: subscription('canceled'),
    });
    stripe.answer('GET', '/v1/invoice_payments', {
      body: {
        object: 'list',
        data: [
          {
            id: 'inpay_free_plan_1',
            object: 'invoice_payment',
            payment: { type: 'payment_intent', payment_intent: 'pi_free_plan_1' },
          },
        ],
      },
    });
    stripe.answer('POST', '/v1/refunds', { body: { id: 're_free_plan_1', object: 'refund' } });

    const withdrawn = await app.inject({
      method: 'POST',
      url: `/v1/accounts/${ACCOUNT_ID}/withdraw`,
      headers: { cookie: `${SESSION_COOKIE_NAME}=${OWNER_SESSION}`, origin: E2E_DASHBOARD_ORIGIN },
    });

    expect(withdrawn.statusCode).toBe(200);
    expect(withdrawn.json()).toEqual({
      status: 'free',
      refunded_amount: 3900,
      fit_by: FIT_BY.toISOString(),
    });
    expect(stripe.requests.map(({ method, path }) => `${method} ${path}`)).toEqual([
      'GET /v1/invoices',
      `DELETE /v1/subscriptions/${SUBSCRIPTION}`,
      'GET /v1/invoices',
      'GET /v1/invoice_payments',
      'POST /v1/refunds',
    ]);
    expect(await accountRow()).toMatchObject({
      status: 'free',
      stripe_customer_id: CUSTOMER,
      stripe_subscription_id: null,
    });
    expect(mail.accountNotices).toEqual([
      {
        email: OWNER_EMAIL,
        notice: { kind: 'withdrawn_to_free', refundedAmount: 3900, fitBy: FIT_BY },
        language: 'pt-BR',
      },
    ]);
  });

  it('keeps the account on the free plan when Stripe reports the cancellation afterwards', async () => {
    const deleted = await webhook(EVENT_IDS[1] ?? '', 'customer.subscription.deleted', 'canceled');

    expect(deleted.statusCode).toBe(200);
    expect(deleted.json()).toEqual({ received: 'ignored' });
    expect((await accountRow())?.status).toBe('free');
  });

  it('refuses a second withdrawal: there is no paid subscription left', async () => {
    const again = await app.inject({
      method: 'POST',
      url: `/v1/accounts/${ACCOUNT_ID}/withdraw`,
      headers: { cookie: `${SESSION_COOKIE_NAME}=${OWNER_SESSION}`, origin: E2E_DASHBOARD_ORIGIN },
    });

    expect(again.statusCode).toBe(409);
    expect(again.json()).toMatchObject({ error: 'withdrawal_unavailable' });
  });
});
