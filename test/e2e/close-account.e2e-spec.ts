import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import postgres from 'postgres';
import Stripe from 'stripe';
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
const WEBHOOK_SECRET = 'whsec_close_e2e';
const OWNER_ID = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c01';
const MEMBER_ID = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c02';
const ACCOUNT_ID = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c11';
const SHOP_ID = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c21';
const OWNER_EMAIL = 'close-owner@example.com';
const OWNER_SESSION = 'e2e-close-owner-session';
const MEMBER_SESSION = 'e2e-close-member-session';
const SHOP_KEY = `pyxis_pk_${'C'.repeat(32)}`;
const DELETED_EVENT_ID = 'evt_close_e2e_deleted';
const CLOSE_URL = `/v1/accounts/${ACCOUNT_ID}/close`;

function invoice(id: string, paidAt: number | null, amountPaid: number): object {
  return {
    id,
    object: 'invoice',
    amount_paid: amountPaid,
    status_transitions: { paid_at: paidAt },
  };
}

function cancelledSubscription(): object {
  return {
    id: 'sub_close_e2e',
    object: 'subscription',
    customer: 'cus_close_e2e',
    status: 'canceled',
    metadata: { account_id: ACCOUNT_ID },
    trial_end: null,
    cancel_at: null,
    cancel_at_period_end: false,
    items: {
      object: 'list',
      data: [
        {
          current_period_end: NOW_SECONDS + 28 * DAY_SECONDS,
          price: { recurring: { interval: 'month' } },
        },
      ],
    },
  };
}

describe('POST /v1/accounts/{accountId}/close', () => {
  let app: NestFastifyApplication;
  let owner: postgres.Sql;
  const stripe = fakeStripe();
  const mail = new RecordingMailSender();

  const close = (payload: Record<string, unknown>, session = OWNER_SESSION) =>
    app.inject({
      method: 'POST',
      url: CLOSE_URL,
      payload,
      headers: { cookie: `${SESSION_COOKIE_NAME}=${session}`, origin: E2E_DASHBOARD_ORIGIN },
    });

  const accountRow = async () => {
    const [row] = await owner<
      { status: string; access_ends_at: Date | null; ended_notified_at: Date | null }[]
    >`SELECT status, access_ends_at, ended_notified_at FROM accounts WHERE id = ${ACCOUNT_ID}`;
    return row;
  };

  beforeAll(async () => {
    owner = postgres(e2eOwnerUrl(), { max: 1, onnotice: () => undefined });
    await owner`
      INSERT INTO admin_users (id, email, email_language)
      VALUES (${OWNER_ID}, ${OWNER_EMAIL}, 'pt-BR'), (${MEMBER_ID}, 'close-member@example.com', 'en')
    `;
    await owner`
      INSERT INTO accounts (id, owner_admin_id, status, stripe_customer_id, stripe_subscription_id)
      VALUES (${ACCOUNT_ID}, ${OWNER_ID}, 'active', 'cus_close_e2e', 'sub_close_e2e')
    `;
    await owner`
      INSERT INTO projects (id, name, account_id) VALUES (${SHOP_ID}, 'Closing shop', ${ACCOUNT_ID})
    `;
    await owner`
      INSERT INTO project_keys (project_id, kind, public_key) VALUES (${SHOP_ID}, 'public', ${SHOP_KEY})
    `;
    await owner`
      INSERT INTO admin_project_access (admin_user_id, project_id)
      VALUES (${OWNER_ID}, ${SHOP_ID}), (${MEMBER_ID}, ${SHOP_ID})
    `;
    await owner`
      INSERT INTO admin_sessions (admin_user_id, token_hash, created_at, last_used_at)
      VALUES (${OWNER_ID}, ${sha256Hex(OWNER_SESSION)}, ${NOW}, ${NOW}),
             (${MEMBER_ID}, ${sha256Hex(MEMBER_SESSION)}, ${NOW}, ${NOW})
    `;
    app = await createTestApp((builder) =>
      builder
        .overrideProvider(CLOCK)
        .useValue(new FixedClock(NOW))
        .overrideProvider(BILLING_GATEWAY)
        .useValue(new StripeBillingGateway(stripe.stripe, WEBHOOK_SECRET))
        .overrideProvider(MAIL_SENDER)
        .useValue(mail),
    );
  });

  afterAll(async () => {
    await app.close();
    await owner`DELETE FROM projects WHERE id = ${SHOP_ID}`;
    await owner`DELETE FROM accounts WHERE id = ${ACCOUNT_ID}`;
    await owner`DELETE FROM admin_sessions WHERE admin_user_id IN (${OWNER_ID}, ${MEMBER_ID})`;
    await owner`DELETE FROM admin_users WHERE id IN (${OWNER_ID}, ${MEMBER_ID})`;
    await owner`DELETE FROM billing_events WHERE id = ${DELETED_EVENT_ID}`;
    await owner.end();
  });

  it('refuses a person who is not the owner and a confirmation that is not the owner e-mail', async () => {
    const member = await close({ confirm_email: 'close-member@example.com' }, MEMBER_SESSION);
    const mismatch = await close({ confirm_email: 'someone@example.com' });
    const anonymous = await app.inject({
      method: 'POST',
      url: CLOSE_URL,
      payload: { confirm_email: OWNER_EMAIL },
      headers: { origin: E2E_DASHBOARD_ORIGIN },
    });

    expect(member.statusCode).toBe(404);
    expect(member.json()).toMatchObject({ error: 'account_not_found' });
    expect(mismatch.statusCode).toBe(409);
    expect(mismatch.json()).toMatchObject({ error: 'confirmation_mismatch' });
    expect(anonymous.statusCode).toBe(401);
    expect(stripe.requests).toEqual([]);
    expect((await accountRow())?.status).toBe('active');
  });

  it('cancels at once, refunds a first payment of this week, revokes the keys and tells the owner', async () => {
    stripe.answer('DELETE', '/v1/subscriptions/sub_close_e2e', { body: cancelledSubscription() });
    stripe.answer('GET', '/v1/invoices', {
      body: {
        object: 'list',
        data: [
          invoice('in_close_1', NOW_SECONDS - 2 * DAY_SECONDS, 3900),
          invoice('in_close_0', null, 0),
        ],
      },
    });
    stripe.answer('GET', '/v1/invoice_payments', {
      body: {
        object: 'list',
        data: [
          {
            id: 'inpay_close_1',
            object: 'invoice_payment',
            payment: { type: 'payment_intent', payment_intent: 'pi_close_1' },
          },
        ],
      },
    });
    stripe.answer('POST', '/v1/refunds', { body: { id: 're_close_1', object: 'refund' } });

    const closed = await close({ confirm_email: 'Close-Owner@Example.com' });

    expect(closed.statusCode).toBe(200);
    expect(closed.json()).toEqual({
      access_ends_at: NOW.toISOString(),
      deletion_on: '2026-12-20T15:00:00.000Z',
      refunded_amount: 3900,
    });
    expect(stripe.requests.map(({ method, path }) => `${method} ${path}`)).toEqual([
      'DELETE /v1/subscriptions/sub_close_e2e',
      'GET /v1/invoices',
      'GET /v1/invoice_payments',
      'POST /v1/refunds',
    ]);
    expect(stripe.requests[3]?.form.get('payment_intent')).toBe('pi_close_1');
    expect(await accountRow()).toEqual({
      status: 'ended',
      access_ends_at: NOW,
      ended_notified_at: NOW,
    });
    const [key] = await owner<{ revoked_at: Date | null }[]>`
      SELECT revoked_at FROM project_keys WHERE public_key = ${SHOP_KEY}
    `;
    expect(key).toEqual({ revoked_at: NOW });
    expect(mail.accountNotices).toEqual([
      {
        email: OWNER_EMAIL,
        notice: { kind: 'access_ended', deletionOn: new Date('2026-12-20T15:00:00.000Z') },
        language: 'pt-BR',
      },
    ]);
  });

  it('keeps the end of access when Stripe reports the cancellation afterwards', async () => {
    stripe.answer('GET', '/v1/subscriptions/sub_close_e2e', { body: cancelledSubscription() });
    const payload = JSON.stringify({
      id: DELETED_EVENT_ID,
      object: 'event',
      type: 'customer.subscription.deleted',
      data: { object: cancelledSubscription() },
    });

    const delivered = await app.inject({
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

    expect(delivered.statusCode).toBe(200);
    expect(delivered.json()).toEqual({ received: 'applied' });
    expect(await accountRow()).toEqual({
      status: 'ended',
      access_ends_at: NOW,
      ended_notified_at: NOW,
    });
  });

  it('refuses to close an account twice', async () => {
    const again = await close({ confirm_email: OWNER_EMAIL });

    expect(again.statusCode).toBe(409);
    expect(again.json()).toMatchObject({ error: 'account_ended' });
  });
});
