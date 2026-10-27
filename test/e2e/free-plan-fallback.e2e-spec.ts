import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import postgres from 'postgres';
import Stripe from 'stripe';
import { SIGN_UP_SETTINGS } from '../../src/domain/accounts/sign-up-settings';
import { BILLING_GATEWAY } from '../../src/domain/billing/billing-gateway';
import { CLOCK } from '../../src/domain/services/clock';
import { MAIL_SENDER } from '../../src/domain/services/mail-sender';
import { StripeBillingGateway } from '../../src/infra/billing/stripe-billing-gateway';
import { FixedClock } from '../../src/test-utils/fixed-clock';
import { RecordingMailSender } from '../../src/test-utils/recording-mail-sender';
import { fakeStripe } from '../../src/test-utils/stripe-fake-http';
import { createTestApp } from './create-test-app';
import { e2eOwnerUrl } from './e2e-database';
import { E2E_DASHBOARD_ORIGIN } from './env-setup';

const NOW = new Date('2026-12-21T15:00:00.000Z');
const NOW_SECONDS = NOW.getTime() / 1000;
const WEBHOOK_SECRET = 'whsec_free_plan_fallback_e2e';

interface Customer {
  readonly ownerId: string;
  readonly accountId: string;
  readonly email: string;
  readonly projects: readonly string[];
  readonly termsVersion: string;
}

const FITS: Customer = {
  ownerId: '5e6f7a8b-0000-4000-8000-000000000001',
  accountId: '5e6f7a8b-0000-4000-8000-000000000011',
  email: 'fallback-fits@example.com',
  projects: ['5e6f7a8b-0000-4000-8000-000000000021'],
  termsVersion: '1.3',
};
const TOO_BIG: Customer = {
  ownerId: '5e6f7a8b-0000-4000-8000-000000000002',
  accountId: '5e6f7a8b-0000-4000-8000-000000000012',
  email: 'fallback-too-big@example.com',
  projects: ['5e6f7a8b-0000-4000-8000-000000000022', '5e6f7a8b-0000-4000-8000-000000000023'],
  termsVersion: '1.3',
};
const EARLIER: Customer = {
  ownerId: '5e6f7a8b-0000-4000-8000-000000000003',
  accountId: '5e6f7a8b-0000-4000-8000-000000000013',
  email: 'fallback-earlier@example.com',
  projects: ['5e6f7a8b-0000-4000-8000-000000000024'],
  termsVersion: '1.2',
};
const SWITCHED_OFF: Customer = {
  ownerId: '5e6f7a8b-0000-4000-8000-000000000004',
  accountId: '5e6f7a8b-0000-4000-8000-000000000014',
  email: 'fallback-switched-off@example.com',
  projects: ['5e6f7a8b-0000-4000-8000-000000000025'],
  termsVersion: '1.3',
};
const CUSTOMERS = [FITS, TOO_BIG, EARLIER, SWITCHED_OFF];

function subscriptionIdOf(customer: Customer): string {
  return `sub_fallback_${customer.accountId.slice(-2)}`;
}

function customerIdOf(customer: Customer): string {
  return `cus_fallback_${customer.accountId.slice(-2)}`;
}

function canceledSubscription(customer: Customer): object {
  return {
    id: subscriptionIdOf(customer),
    object: 'subscription',
    customer: customerIdOf(customer),
    status: 'canceled',
    metadata: { account_id: customer.accountId },
    trial_end: null,
    cancel_at: null,
    cancel_at_period_end: false,
    items: {
      object: 'list',
      data: [{ current_period_end: NOW_SECONDS, price: { recurring: { interval: 'month' } } }],
    },
  };
}

describe('a cancelled subscription falling back to the free plan, over HTTP', () => {
  let app: NestFastifyApplication;
  let owner: postgres.Sql;
  const stripe = fakeStripe();
  const mail = new RecordingMailSender();
  const settings = {
    open: true,
    termsVersion: '1.3',
    termsUrl: 'https://pyxis.example.com/terms',
    dashboardOrigin: E2E_DASHBOARD_ORIGIN,
    freePlanOpen: true,
    freeAccountsMax: 200,
    trialOffered: false,
    freePlanTermsForEarlierAccountsFrom: null,
  };

  const endSubscriptionOf = (customer: Customer) => {
    const body = canceledSubscription(customer);
    stripe.answer('GET', `/v1/subscriptions/${subscriptionIdOf(customer)}`, { body });
    const payload = JSON.stringify({
      id: `evt_fallback_${customer.accountId.slice(-2)}`,
      object: 'event',
      type: 'customer.subscription.deleted',
      data: { object: body },
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

  const accountOf = async (customer: Customer) => {
    const [row] = await owner<
      {
        status: string;
        stripe_customer_id: string | null;
        stripe_subscription_id: string | null;
        access_ends_at: Date | null;
        back_to_free_notice_due_at: Date | null;
      }[]
    >`
      SELECT status, stripe_customer_id, stripe_subscription_id, access_ends_at,
             back_to_free_notice_due_at
      FROM accounts WHERE id = ${customer.accountId}
    `;
    return row;
  };

  beforeAll(async () => {
    owner = postgres(e2eOwnerUrl(), { max: 1, onnotice: () => undefined });
    for (const customer of CUSTOMERS) {
      await owner`
        INSERT INTO admin_users (id, email, email_language)
        VALUES (${customer.ownerId}, ${customer.email}, 'en')
      `;
      await owner`
        INSERT INTO accounts (
          id, owner_admin_id, status, stripe_customer_id, stripe_subscription_id, billing_interval
        )
        VALUES (
          ${customer.accountId}, ${customer.ownerId}, 'ending', ${customerIdOf(customer)},
          ${subscriptionIdOf(customer)}, 'month'
        )
      `;
      await owner`
        INSERT INTO terms_acceptances (admin_user_id, account_id, version, accepted_at)
        VALUES (${customer.ownerId}, ${customer.accountId}, ${customer.termsVersion}, ${NOW})
      `;
      for (const projectId of customer.projects) {
        await owner`
          INSERT INTO projects (id, name, account_id) VALUES (${projectId}, 'Site', ${customer.accountId})
        `;
        await owner`
          INSERT INTO admin_project_access (admin_user_id, project_id)
          VALUES (${customer.ownerId}, ${projectId})
        `;
      }
    }
    app = await createTestApp((builder) =>
      builder
        .overrideProvider(CLOCK)
        .useValue(new FixedClock(NOW))
        .overrideProvider(BILLING_GATEWAY)
        .useValue(new StripeBillingGateway(stripe.stripe, WEBHOOK_SECRET))
        .overrideProvider(MAIL_SENDER)
        .useValue(mail)
        .overrideProvider(SIGN_UP_SETTINGS)
        .useValue(settings),
    );
  });

  afterAll(async () => {
    await app.close();
    const accountIds = CUSTOMERS.map((customer) => customer.accountId);
    const ownerIds = CUSTOMERS.map((customer) => customer.ownerId);
    await owner`DELETE FROM projects WHERE account_id IN ${owner(accountIds)}`;
    await owner`DELETE FROM accounts WHERE id IN ${owner(accountIds)}`;
    await owner`DELETE FROM admin_users WHERE id IN ${owner(ownerIds)}`;
    await owner`DELETE FROM billing_events WHERE id LIKE 'evt_fallback_%'`;
    await owner.end();
  });

  it('puts an account that fits back on free, keeping the customer, and tells the owner', async () => {
    const response = await endSubscriptionOf(FITS);

    expect(response.json()).toEqual({ received: 'applied' });
    expect(await accountOf(FITS)).toEqual({
      status: 'free',
      stripe_customer_id: customerIdOf(FITS),
      stripe_subscription_id: null,
      access_ends_at: null,
      back_to_free_notice_due_at: null,
    });
    expect(mail.accountNotices).toEqual([
      {
        email: FITS.email,
        notice: { kind: 'back_to_free', eventsPerMonth: 10_000 },
        language: 'en',
      },
    ]);
  });

  it('ends an account with more projects than the free plan holds', async () => {
    await endSubscriptionOf(TOO_BIG);

    expect(await accountOf(TOO_BIG)).toMatchObject({ status: 'ended', access_ends_at: NOW });
  });

  it('ends an account whose owner is still bound by the terms before the free plan', async () => {
    await endSubscriptionOf(EARLIER);

    expect(await accountOf(EARLIER)).toMatchObject({ status: 'ended', access_ends_at: NOW });
  });

  it('ends every account while the free plan is closed', async () => {
    settings.freePlanOpen = false;

    await endSubscriptionOf(SWITCHED_OFF);

    expect(await accountOf(SWITCHED_OFF)).toMatchObject({ status: 'ended', access_ends_at: NOW });
    expect(mail.accountNotices).toHaveLength(1);
  });
});
