import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import postgres from 'postgres';
import { TRIAL_DAYS } from '../../src/domain/accounts/hosted-plan';
import { SIGN_UP_SETTINGS } from '../../src/domain/accounts/sign-up-settings';
import { BILLING_GATEWAY } from '../../src/domain/billing/billing-gateway';
import { SESSION_TOKEN_PATTERN } from '../../src/domain/auth/session-policy';
import { MAIL_SENDER } from '../../src/domain/services/mail-sender';
import { StripeBillingGateway } from '../../src/infra/billing/stripe-billing-gateway';
import { SESSION_COOKIE_NAME } from '../../src/infra/http/auth/session-cookie';
import { RecordingMailSender } from '../../src/test-utils/recording-mail-sender';
import { fakeStripe } from '../../src/test-utils/stripe-fake-http';
import { createTestApp } from './create-test-app';
import { e2eOwnerUrl } from './e2e-database';
import { E2E_CLIENT_IP_HEADER, E2E_DASHBOARD_ORIGIN } from './env-setup';

const TERMS = '2026-11-01';
const FOUNDER = 'founder@sign-up.example.com';
const CLOSED_FOUNDER = 'closed@sign-up.example.com';
const MISSING_ACCOUNT = 'ffffffff-ffff-4fff-bfff-ffffffffffff';
const MONTHLY_PRICES = {
  object: 'list',
  data: [{ id: 'price_e2e_month', object: 'price' }],
  has_more: false,
  url: '/v1/prices',
};

let clientCounter = 0;

function nextClientIp(): string {
  clientCounter += 1;
  return `198.51.100.${String(clientCounter)}`;
}

interface Call {
  readonly origin?: string | null;
  readonly cookie?: string;
}

function caller(app: () => NestFastifyApplication) {
  return {
    post: (url: string, payload: Record<string, unknown>, call: Call = {}) =>
      app().inject({
        method: 'POST',
        url,
        payload,
        headers: {
          [E2E_CLIENT_IP_HEADER]: nextClientIp(),
          ...(call.origin === null ? {} : { origin: call.origin ?? E2E_DASHBOARD_ORIGIN }),
          ...(call.cookie === undefined ? {} : { cookie: call.cookie }),
        },
      }),
    get: (url: string, call: Call = {}) =>
      app().inject({
        method: 'GET',
        url,
        headers: {
          origin: E2E_DASHBOARD_ORIGIN,
          ...(call.cookie === undefined ? {} : { cookie: call.cookie }),
        },
      }),
  };
}

describe('sign-up while it is closed', () => {
  let app: NestFastifyApplication;
  let owner: postgres.Sql;
  const mail = new RecordingMailSender();
  const { post, get } = caller(() => app);

  beforeAll(async () => {
    owner = postgres(e2eOwnerUrl(), { max: 1, onnotice: () => undefined });
    app = await createTestApp((builder) => builder.overrideProvider(MAIL_SENDER).useValue(mail));
  });

  afterAll(async () => {
    await app.close();
    await owner.end();
  });

  it('says it is closed, and answers 404 to every step without storing or mailing anything', async () => {
    const status = await get('/v1/auth/sign-up');
    const code = await post('/v1/auth/sign-up/code', { email: CLOSED_FOUNDER });
    const verify = await post('/v1/auth/sign-up/verify', {
      email: CLOSED_FOUNDER,
      code: '123456',
      terms_version: TERMS,
    });

    expect(status.json()).toEqual({ open: false, terms_version: null, terms_url: null });
    expect(code.statusCode).toBe(404);
    expect(code.json()).toMatchObject({ error: 'sign_up_closed' });
    expect(verify.statusCode).toBe(404);
    expect(mail.signUpCodes).toEqual([]);
    expect(await owner`SELECT 1 FROM otp_codes WHERE email = ${CLOSED_FOUNDER}`).toHaveLength(0);
    expect(await owner`SELECT 1 FROM admin_users WHERE email = ${CLOSED_FOUNDER}`).toHaveLength(0);
  });
});

describe('sign-up while it is open', () => {
  let app: NestFastifyApplication;
  let owner: postgres.Sql;
  const mail = new RecordingMailSender();
  const stripe = fakeStripe();
  const { post, get } = caller(() => app);

  const latestCode = (): string => {
    const delivered = mail.signUpCodes.at(-1);
    if (delivered === undefined) {
      throw new Error('No sign-up code was mailed.');
    }
    return delivered.code;
  };

  const signUp = async (): Promise<{ readonly cookie: string; readonly accountId: string }> => {
    await post('/v1/auth/sign-up/code', { email: FOUNDER, locale: 'pt-BR' });
    const response = await post('/v1/auth/sign-up/verify', {
      email: FOUNDER,
      code: latestCode(),
      terms_version: TERMS,
    });
    const body = response.json<{ session_token: string; account_id: string }>();
    return {
      cookie: `${SESSION_COOKIE_NAME}=${body.session_token}`,
      accountId: body.account_id,
    };
  };

  const removeFounder = async (): Promise<void> => {
    await owner`
      DELETE FROM accounts WHERE owner_admin_id IN (SELECT id FROM admin_users WHERE email = ${FOUNDER})
    `;
    await owner`DELETE FROM admin_users WHERE email = ${FOUNDER}`;
    await owner`DELETE FROM otp_codes WHERE email = ${FOUNDER}`;
  };

  beforeAll(async () => {
    owner = postgres(e2eOwnerUrl(), { max: 1, onnotice: () => undefined });
    app = await createTestApp((builder) =>
      builder
        .overrideProvider(MAIL_SENDER)
        .useValue(mail)
        .overrideProvider(SIGN_UP_SETTINGS)
        .useValue({
          open: true,
          termsVersion: TERMS,
          termsUrl: 'https://pyxis.example.com/terms',
          dashboardOrigin: E2E_DASHBOARD_ORIGIN,
        })
        .overrideProvider(BILLING_GATEWAY)
        .useValue(new StripeBillingGateway(stripe.stripe, null)),
    );
  });

  beforeEach(async () => {
    mail.signUpCodes.length = 0;
    stripe.requests.length = 0;
    await removeFounder();
  });

  afterAll(async () => {
    await removeFounder();
    await app.close();
    await owner.end();
  });

  it('tells the dashboard which version of the terms to show', async () => {
    const response = await get('/v1/auth/sign-up');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      open: true,
      terms_version: TERMS,
      terms_url: 'https://pyxis.example.com/terms',
    });
  });

  it('creates the owner, an account waiting for its subscription and the acceptance of the terms', async () => {
    const requested = await post('/v1/auth/sign-up/code', { email: 'Founder@Sign-Up.example.com' });
    expect(requested.statusCode).toBe(202);
    expect(mail.signUpCodes).toEqual([
      { email: FOUNDER, code: expect.stringMatching(/^\d{6}$/) as string, language: 'en' },
    ]);

    const verified = await post('/v1/auth/sign-up/verify', {
      email: FOUNDER,
      code: latestCode(),
      terms_version: TERMS,
    });

    expect(verified.statusCode).toBe(200);
    const body = verified.json<{ email: string; session_token: string; account_id: string }>();
    expect(body.email).toBe(FOUNDER);
    expect(body.session_token).toMatch(SESSION_TOKEN_PATTERN);
    const [account] = await owner<{ status: string; email: string; version: string }[]>`
      SELECT a.status, u.email, t.version
      FROM accounts a
      JOIN admin_users u ON u.id = a.owner_admin_id
      JOIN terms_acceptances t ON t.account_id = a.id AND t.admin_user_id = u.id
      WHERE a.id = ${body.account_id}
    `;
    expect(account).toEqual({ status: 'incomplete', email: FOUNDER, version: TERMS });
  });

  it('refuses terms the dashboard showed before they changed, and keeps the code usable', async () => {
    await post('/v1/auth/sign-up/code', { email: FOUNDER });

    const outdated = await post('/v1/auth/sign-up/verify', {
      email: FOUNDER,
      code: latestCode(),
      terms_version: '2026-01-01',
    });
    const current = await post('/v1/auth/sign-up/verify', {
      email: FOUNDER,
      code: latestCode(),
      terms_version: TERMS,
    });

    expect(outdated.statusCode).toBe(409);
    expect(outdated.json()).toMatchObject({ error: 'terms_outdated' });
    expect(current.statusCode).toBe(200);
  });

  it('refuses a request that does not come from the dashboard', async () => {
    const response = await post(
      '/v1/auth/sign-up/code',
      { email: FOUNDER },
      { origin: 'https://evil.example.com' },
    );

    expect(response.statusCode).toBe(403);
    expect(mail.signUpCodes).toEqual([]);
  });

  it('lists the new account for its owner, not measured yet', async () => {
    const { cookie, accountId } = await signUp();

    const response = await get('/v1/me/accounts', { cookie });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      accounts: [
        expect.objectContaining({
          id: accountId,
          role: 'owner',
          status: 'incomplete',
          events_this_month: null,
          limits: { events_per_month: 100_000, projects: 3, people: 3 },
        }),
      ],
    });
  });

  it('opens a Checkout with the free trial for the owner, and only for the owner', async () => {
    const { cookie, accountId } = await signUp();
    stripe.answer('GET', '/v1/prices', { body: MONTHLY_PRICES });
    stripe.answer('POST', '/v1/checkout/sessions', {
      body: { id: 'cs_e2e', object: 'checkout.session', url: 'https://checkout.stripe.com/c/e2e' },
    });

    const opened = await post(
      `/v1/accounts/${accountId}/checkout`,
      { interval: 'month', locale: 'pt-BR' },
      { cookie },
    );
    const someoneElses = await post(
      `/v1/accounts/${MISSING_ACCOUNT}/checkout`,
      { interval: 'month' },
      { cookie },
    );
    const notAnId = await post(
      '/v1/accounts/not-an-id/checkout',
      { interval: 'month' },
      { cookie },
    );

    expect(opened.statusCode).toBe(200);
    expect(opened.json()).toEqual({ url: 'https://checkout.stripe.com/c/e2e' });
    const form = stripe.requests.find(({ path }) => path === '/v1/checkout/sessions')?.form;
    expect(form?.get('client_reference_id')).toBe(accountId);
    expect(form?.get('customer_email')).toBe(FOUNDER);
    expect(form?.get('subscription_data[trial_period_days]')).toBe(String(TRIAL_DAYS));
    expect(form?.get('locale')).toBe('pt-BR');
    expect(form?.get('success_url')).toBe(`${E2E_DASHBOARD_ORIGIN}/welcome?account=${accountId}`);
    expect(someoneElses.statusCode).toBe(404);
    expect(someoneElses.json()).toMatchObject({ error: 'account_not_found' });
    expect(notAnId.statusCode).toBe(400);
  });

  it('has no billing portal before the first subscription, and needs a session', async () => {
    const { cookie, accountId } = await signUp();

    const portal = await post(`/v1/accounts/${accountId}/portal`, {}, { cookie });
    const anonymous = await post(`/v1/accounts/${accountId}/portal`, {});

    expect(portal.statusCode).toBe(409);
    expect(portal.json()).toMatchObject({ error: 'no_billing_yet' });
    expect(anonymous.statusCode).toBe(401);
  });
});
