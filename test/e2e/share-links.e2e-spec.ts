import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import postgres from 'postgres';
import { sha256Hex } from '../../src/domain/auth/hashing';
import { CLOCK } from '../../src/domain/services/clock';
import { SHARE_TOKEN_PATTERN } from '../../src/domain/share-links/share-link';
import { SESSION_COOKIE_NAME } from '../../src/infra/http/auth/session-cookie';
import { SHARED_REPORT_REQUESTS_PER_WINDOW } from '../../src/infra/http/rate-limit/rate-limits';
import { FixedClock } from '../../src/test-utils/fixed-clock';
import { createTestApp } from './create-test-app';
import { e2eOwnerUrl } from './e2e-database';
import { E2E_CLIENT_IP_HEADER, E2E_DASHBOARD_ORIGIN } from './env-setup';

const NOW = new Date('2026-11-05T15:00:00.000Z');
const ONE_HOUR_MS = 3_600_000;
const OWNER_ID = 'e7a00000-0000-4000-8000-000000000001';
const MEMBER_ID = 'e7a00000-0000-4000-8000-000000000002';
const ACCOUNT_ID = 'e7a00000-0000-4000-8000-000000000011';
const MISSING_ID = 'ffffffff-ffff-4fff-bfff-ffffffffffff';
const OWNER_COOKIE = `${SESSION_COOKIE_NAME}=e2e-share-owner-session`;
const MEMBER_COOKIE = `${SESSION_COOKIE_NAME}=e2e-share-member-session`;
const BUYER = 'e7a00000-0000-4000-8000-000000000101';
const BROWSER = 'e7a00000-0000-4000-8000-000000000102';
const RANGE = 'from=2026-11-05&to=2026-11-05';
const STEPS = encodeURIComponent(
  JSON.stringify([
    { type: 'page', path: '/pricing' },
    { type: 'event', name: 'purchase' },
  ]),
);
const SHARED_REPORT_QUERIES = [
  ['overview', RANGE],
  ['time-of-day', RANGE],
  ['goals/summary', RANGE],
  ['acquisition', `${RANGE}&channel=direct`],
  ['devices', `${RANGE}&device=desktop`],
  ['features', `${RANGE}&kind=events`],
  ['engagement', RANGE],
  ['funnel', `${RANGE}&mode=visit&steps=${STEPS}`],
  ['funnel/segments', `${RANGE}&steps=${STEPS}&by=device`],
] as const;
const PERSONAL_ROUTES = [
  `visits?${RANGE}`,
  `timeline?session_id=${BUYER}`,
  `requests?${RANGE}`,
  `funnel/subjects?${RANGE}&mode=visit&steps=${STEPS}&step=2&outcome=reached`,
  `features/properties?${RANGE}&event=purchase`,
  'settings',
  'goals',
] as const;

interface ShareLinkBody {
  readonly id: string;
  readonly name: string;
  readonly created_at: string;
  readonly expires_at: string | null;
  readonly token?: string;
}

interface Call {
  readonly cookie?: string | null;
  readonly origin?: string | null;
  readonly payload?: object;
  readonly clientIp?: string;
}

describe('share links, over HTTP', () => {
  let app: NestFastifyApplication;
  let owner: postgres.Sql;
  let projectId = '';
  let clientIpSequence = 0;
  const clock = new FixedClock(NOW);

  const call = (method: 'GET' | 'POST' | 'DELETE', url: string, options: Call = {}) => {
    clientIpSequence += 1;
    const cookie = options.cookie === undefined ? OWNER_COOKIE : options.cookie;
    const origin = options.origin === undefined ? E2E_DASHBOARD_ORIGIN : options.origin;
    return app.inject({
      method,
      url,
      ...(options.payload === undefined ? {} : { payload: options.payload }),
      headers: {
        [E2E_CLIENT_IP_HEADER]: options.clientIp ?? `198.51.100.${String(clientIpSequence % 250)}`,
        ...(cookie === null ? {} : { cookie }),
        ...(origin === null ? {} : { origin }),
      },
    });
  };
  const anonymous = (url: string, clientIp?: string) =>
    call('GET', url, {
      cookie: null,
      origin: null,
      ...(clientIp === undefined ? {} : { clientIp }),
    });
  const linksUrl = () => `/v1/projects/${projectId}/share-links`;
  const createLink = async (payload: object = { name: 'For the agency' }) => {
    const response = await call('POST', linksUrl(), { payload });
    expect(response.statusCode).toBe(201);
    return response.json<ShareLinkBody & { token: string }>();
  };
  const setStatus = (status: string) =>
    owner`UPDATE accounts SET status = ${status} WHERE id = ${ACCOUNT_ID}`;

  beforeAll(async () => {
    owner = postgres(e2eOwnerUrl(), { max: 1, onnotice: () => undefined });
    await owner`
      INSERT INTO admin_users (id, email)
      VALUES (${OWNER_ID}, 'share-owner@example.com'),
             (${MEMBER_ID}, 'share-member@example.com')`;
    await owner`
      INSERT INTO accounts (id, owner_admin_id, status) VALUES (${ACCOUNT_ID}, ${OWNER_ID}, 'active')`;
    await owner`
      INSERT INTO admin_sessions (admin_user_id, token_hash, created_at, last_used_at)
      VALUES (${OWNER_ID}, ${sha256Hex('e2e-share-owner-session')}, ${NOW}, ${NOW}),
             (${MEMBER_ID}, ${sha256Hex('e2e-share-member-session')}, ${NOW}, ${NOW})`;
    app = await createTestApp((builder) => builder.overrideProvider(CLOCK).useValue(clock));
    const created = await call('POST', `/v1/accounts/${ACCOUNT_ID}/projects`, {
      payload: {
        name: 'Shared shop',
        allowed_origins: ['https://shared-shop.example.com'],
        timezone: 'UTC',
        conversion_event: 'purchase',
        currency: 'USD',
      },
    });
    projectId = created.json<{ project_id: string }>().project_id;
    await owner`
      INSERT INTO admin_project_access (admin_user_id, project_id) VALUES (${MEMBER_ID}, ${projectId})`;
    await owner`
      INSERT INTO events (id, project_id, occurred_at, received_at, name, session_id, user_id,
                          path, device_type, browser, os, properties)
      VALUES
        (gen_random_uuid(), ${projectId}, '2026-11-05T10:00:00Z', ${NOW}, 'page_view', ${BUYER},
         'buyer-42', '/pricing', 'desktop', 'chrome', 'macos', '{}'),
        (gen_random_uuid(), ${projectId}, '2026-11-05T10:01:00Z', ${NOW}, 'purchase', ${BUYER},
         'buyer-42', '/pricing', 'desktop', 'chrome', 'macos', '{"revenue": 129.9}'),
        (gen_random_uuid(), ${projectId}, '2026-11-05T11:00:00Z', ${NOW}, 'page_view', ${BROWSER},
         null, '/', 'mobile', 'safari', 'ios', '{}')`;
  });

  afterAll(async () => {
    await app.close();
    await owner`DELETE FROM projects WHERE account_id = ${ACCOUNT_ID}`;
    await owner`DELETE FROM accounts WHERE id = ${ACCOUNT_ID}`;
    await owner`DELETE FROM admin_sessions WHERE admin_user_id IN (${OWNER_ID}, ${MEMBER_ID})`;
    await owner`DELETE FROM admin_users WHERE id IN (${OWNER_ID}, ${MEMBER_ID})`;
    await owner.end();
  });

  afterEach(async () => {
    await setStatus('active');
    await owner`UPDATE accounts SET suspended_at = null, suspension_reason = null
      WHERE id = ${ACCOUNT_ID}`;
    await owner`DELETE FROM share_links WHERE project_id = ${projectId}`;
  });

  it('answers the token once and keeps only its hash', async () => {
    const created = await createLink({ name: '  For the agency ' });

    expect(created).toEqual({
      id: expect.any(String) as string,
      name: 'For the agency',
      created_at: NOW.toISOString(),
      expires_at: null,
      token: expect.stringMatching(SHARE_TOKEN_PATTERN) as string,
    });
    const listed = await call('GET', linksUrl(), { origin: null });
    expect(listed.json()).toEqual({
      links: [
        { id: created.id, name: 'For the agency', created_at: NOW.toISOString(), expires_at: null },
      ],
    });
    const stored = await owner<{ token_hash: string }[]>`
      SELECT token_hash FROM share_links WHERE id = ${created.id}`;
    expect(stored).toEqual([{ token_hash: sha256Hex(created.token) }]);
  });

  it('opens the project and its goals without a session', async () => {
    const { token } = await createLink();

    const opened = await anonymous(`/v1/shared/${token}`);

    expect(opened.statusCode).toBe(200);
    expect(opened.json()).toEqual({
      project: {
        name: 'Shared shop',
        timezone: 'UTC',
        currency: 'USD',
        city_enabled: false,
        visitors_enabled: false,
      },
      goals: [expect.objectContaining({ name: 'purchase', type: 'event', event: 'purchase' })],
      expires_at: null,
    });
  });

  it.each(SHARED_REPORT_QUERIES)(
    'answers %s exactly as the dashboard does, with its filters',
    async (report, query) => {
      const { token } = await createLink();

      const shared = await anonymous(`/v1/shared/${token}/${report}?${query}`);
      const dashboard = await call('GET', `/v1/projects/${projectId}/${report}?${query}`);

      expect(shared.statusCode).toBe(200);
      expect(dashboard.statusCode).toBe(200);
      expect(shared.json()).toEqual(dashboard.json());
    },
  );

  it('counts the revenue of the goal chosen with goal', async () => {
    const { token } = await createLink();
    const goalId = (await anonymous(`/v1/shared/${token}`)).json<{ goals: { id: string }[] }>()
      .goals[0]?.id;

    const overview = await anonymous(`/v1/shared/${token}/overview?${RANGE}&goal=${goalId ?? ''}`);

    expect(overview.json()).toMatchObject({
      kpis: { conversions: { current: 1 }, revenue: { current: 129.9 } },
    });
  });

  it.each(PERSONAL_ROUTES)('has no shared route for %s', async (route) => {
    const { token } = await createLink();

    const response = await anonymous(`/v1/shared/${token}/${route}`);

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: 'not_found' });
  });

  it('validates the query of a shared report as the dashboard does', async () => {
    const { token } = await createLink();

    const response = await anonymous(`/v1/shared/${token}/overview?from=2026-11-05`);

    expect(response.statusCode).toBe(400);
  });

  it.each(
    SHARED_REPORT_QUERIES.flatMap(([report, query]) => [
      [report, 'identity=identified', query],
      [report, 'event=purchase&property=order_id%3D42', query],
    ]),
  )('refuses %s with %s, which the dashboard takes', async (report, narrowing, query) => {
    const { token } = await createLink();

    const shared = await anonymous(`/v1/shared/${token}/${report}?${query}&${narrowing}`);
    const dashboard = await call(
      'GET',
      `/v1/projects/${projectId}/${report}?${query}&${narrowing}`,
    );

    expect(shared.statusCode).toBe(400);
    expect(shared.json()).toMatchObject({ error: 'invalid_request' });
    expect(dashboard.statusCode).toBe(200);
  });

  it('answers one 404 for an unknown, revoked, expired, free or suspended link', async () => {
    const unknown = await anonymous(`/v1/shared/pyxis_sh_${'Z'.repeat(32)}/overview?${RANGE}`);
    const malformed = await anonymous(`/v1/shared/not-a-token?${RANGE}`);
    const revoked = await createLink();
    await call('DELETE', `${linksUrl()}/${revoked.id}`);
    const afterRevoke = await anonymous(`/v1/shared/${revoked.token}`);
    const expiring = await createLink({
      name: 'For an hour',
      expires_at: new Date(NOW.getTime() + ONE_HOUR_MS).toISOString(),
    });
    clock.advanceBy(ONE_HOUR_MS);
    const afterExpiry = await anonymous(`/v1/shared/${expiring.token}`);
    clock.advanceBy(-ONE_HOUR_MS);
    const live = await createLink({ name: 'Board' });
    await setStatus('free');
    const onFree = await anonymous(`/v1/shared/${live.token}/overview?${RANGE}`);
    await setStatus('active');
    await owner`UPDATE accounts SET suspended_at = ${NOW}, suspension_reason = 'abuse'
      WHERE id = ${ACCOUNT_ID}`;
    const suspended = await anonymous(`/v1/shared/${live.token}`);

    const answers = [unknown, malformed, afterRevoke, afterExpiry, onFree, suspended];
    expect(answers.map((answer) => answer.statusCode)).toEqual([404, 404, 404, 404, 404, 404]);
    expect(new Set(answers.map((answer) => answer.body)).size).toBe(1);
    expect(unknown.json()).toMatchObject({ error: 'share_link_not_found' });
  });

  it('opens again when the account comes back to Pro', async () => {
    const { token } = await createLink();
    await setStatus('free');
    expect((await anonymous(`/v1/shared/${token}`)).statusCode).toBe(404);

    await setStatus('active');

    expect((await anonymous(`/v1/shared/${token}`)).statusCode).toBe(200);
  });

  it('refuses to create a link on the free plan with plan_required, and lists and revokes', async () => {
    const { id } = await createLink();
    await setStatus('free');

    const refused = await call('POST', linksUrl(), { payload: { name: 'Board' } });
    const listed = await call('GET', linksUrl());
    const revoked = await call('DELETE', `${linksUrl()}/${id}`);

    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toMatchObject({ error: 'plan_required' });
    expect(listed.json<{ links: unknown[] }>().links).toHaveLength(1);
    expect(revoked.statusCode).toBe(204);
  });

  it('answers 404 to a person on the project who does not own the account', async () => {
    const { id } = await createLink();

    const answers = await Promise.all([
      call('POST', linksUrl(), { cookie: MEMBER_COOKIE, payload: { name: 'Mine' } }),
      call('GET', linksUrl(), { cookie: MEMBER_COOKIE }),
      call('DELETE', `${linksUrl()}/${id}`, { cookie: MEMBER_COOKIE }),
    ]);

    expect(answers.map((answer) => answer.statusCode)).toEqual([404, 404, 404]);
    expect(answers[0].json()).toMatchObject({ error: 'project_not_found' });
  });

  it('answers share_link_not_found when revoking a link the project does not have', async () => {
    const response = await call('DELETE', `${linksUrl()}/${MISSING_ID}`);

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: 'share_link_not_found' });
  });

  it.each([
    ['without a name', { expires_at: null }],
    ['with an expiry in the past', { name: 'Old', expires_at: '2026-11-04T00:00:00.000Z' }],
    ['with an unknown field', { name: 'Board', password: 'x' }],
  ])('refuses a link %s', async (_case, payload) => {
    const response = await call('POST', linksUrl(), { payload });

    expect(response.statusCode).toBe(400);
  });

  it('refuses to create or revoke from outside the dashboard', async () => {
    const created = await call('POST', linksUrl(), { origin: null, payload: { name: 'Board' } });
    const revoked = await call('DELETE', `${linksUrl()}/${MISSING_ID}`, { origin: null });

    expect([created.statusCode, revoked.statusCode]).toEqual([403, 403]);
  });

  it('stops an address after its shared reads, whatever the token', async () => {
    const clientIp = '203.0.113.77';
    const unknown = `/v1/shared/pyxis_sh_${'Y'.repeat(32)}`;
    for (let request = 0; request < SHARED_REPORT_REQUESTS_PER_WINDOW; request += 1) {
      await anonymous(unknown, clientIp);
    }

    const response = await anonymous(unknown, clientIp);

    expect(response.statusCode).toBe(429);
    expect(response.json()).toMatchObject({ error: 'rate_limited' });
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('lets the dashboard read a shared report from the browser', async () => {
    const { token } = await createLink();

    const response = await call('GET', `/v1/shared/${token}`, { cookie: null });

    expect(response.headers['access-control-allow-origin']).toBe(E2E_DASHBOARD_ORIGIN);
  });
});
