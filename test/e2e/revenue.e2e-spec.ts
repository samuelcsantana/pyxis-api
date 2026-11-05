import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import postgres from 'postgres';
import { sha256Hex } from '../../src/domain/auth/hashing';
import { CLOCK } from '../../src/domain/services/clock';
import { SESSION_COOKIE_NAME } from '../../src/infra/http/auth/session-cookie';
import { FixedClock } from '../../src/test-utils/fixed-clock';
import { createTestApp } from './create-test-app';
import { e2eOwnerUrl } from './e2e-database';
import { E2E_CLIENT_IP_HEADER, E2E_DASHBOARD_ORIGIN } from './env-setup';

const NOW = new Date('2026-11-04T15:00:00.000Z');
const OWNER_ID = 'e4a00000-0000-4000-8000-00000000e001';
const ACCOUNT_ID = 'e4a00000-0000-4000-8000-00000000e011';
const OWNER_COOKIE = `${SESSION_COOKIE_NAME}=e2e-revenue-owner-session`;
const SITE = 'https://revenue-shop.example.com';
const SESSION = 'e4a00000-0000-4000-9000-00000000e101';
const RANGE = 'from=2026-11-04&to=2026-11-04';
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';

function trackedEvent(index: number, name: string, extra: Record<string, unknown> = {}) {
  return {
    id: `e4a00000-0000-4000-a000-${String(index).padStart(12, '0')}`,
    name,
    occurred_at: `2026-11-04T14:0${String(index)}:00.000Z`,
    session_id: SESSION,
    path: '/checkout',
    ...extra,
  };
}

describe('revenue and the project currency, over HTTP', () => {
  let app: NestFastifyApplication;
  let owner: postgres.Sql;
  let projectId = '';
  let publicKey = '';

  const call = (method: 'GET' | 'POST' | 'PATCH', url: string, payload?: object) =>
    app.inject({
      method,
      url,
      ...(payload === undefined ? {} : { payload }),
      headers: { cookie: OWNER_COOKIE, origin: E2E_DASHBOARD_ORIGIN },
    });

  beforeAll(async () => {
    owner = postgres(e2eOwnerUrl(), { max: 1, onnotice: () => undefined });
    await owner`INSERT INTO admin_users (id, email) VALUES (${OWNER_ID}, 'revenue@example.com')`;
    await owner`
      INSERT INTO accounts (id, owner_admin_id, status) VALUES (${ACCOUNT_ID}, ${OWNER_ID}, 'free')`;
    await owner`
      INSERT INTO admin_sessions (admin_user_id, token_hash, created_at, last_used_at)
      VALUES (${OWNER_ID}, ${sha256Hex('e2e-revenue-owner-session')}, ${NOW}, ${NOW})`;
    app = await createTestApp((builder) =>
      builder.overrideProvider(CLOCK).useValue(new FixedClock(NOW)),
    );
    const created = await call('POST', `/v1/accounts/${ACCOUNT_ID}/projects`, {
      name: 'Revenue shop',
      allowed_origins: [SITE],
      timezone: 'UTC',
      conversion_event: 'purchase',
      currency: 'USD',
    });
    const body = created.json<{ project_id: string; public_key: { key: string } }>();
    projectId = body.project_id;
    publicKey = body.public_key.key;
  });

  afterAll(async () => {
    await app.close();
    await owner`DELETE FROM projects WHERE account_id = ${ACCOUNT_ID}`;
    await owner`DELETE FROM accounts WHERE id = ${ACCOUNT_ID}`;
    await owner`DELETE FROM admin_sessions WHERE admin_user_id = ${OWNER_ID}`;
    await owner`DELETE FROM admin_users WHERE id = ${OWNER_ID}`;
    await owner.end();
  });

  it('keeps the currency given at creation and shows it in the settings and /v1/me', async () => {
    const settings = await call('GET', `/v1/projects/${projectId}/settings`);
    const me = await call('GET', '/v1/me');

    expect(settings.json()).toMatchObject({ currency: 'USD' });
    expect(
      me
        .json<{ projects: { id: string; currency: string }[] }>()
        .projects.find(({ id }) => id === projectId),
    ).toMatchObject({ currency: 'USD' });
  });

  it('changes the currency, and refuses one that is not ISO 4217', async () => {
    const changed = await call('PATCH', `/v1/projects/${projectId}`, { currency: 'BRL' });
    const unknown = await call('PATCH', `/v1/projects/${projectId}`, { currency: 'XYZ' });
    const lowerCase = await call('PATCH', `/v1/projects/${projectId}`, { currency: 'brl' });

    expect(changed.json()).toMatchObject({ currency: 'BRL' });
    expect(unknown.statusCode).toBe(400);
    expect(unknown.json()).toMatchObject({ error: 'invalid_project_settings' });
    expect(lowerCase.statusCode).toBe(400);
  });

  it('stores a valid revenue intact, drops an invalid one only, and sums it per goal', async () => {
    const batch = await app.inject({
      method: 'POST',
      url: '/v1/batch',
      payload: JSON.stringify({
        key: publicKey,
        sent_at: '2026-11-04T14:09:00.000Z',
        events: [
          trackedEvent(1, 'page_view'),
          trackedEvent(2, 'purchase', { properties: { revenue: 129.9, plan: 'pro' } }),
          trackedEvent(3, 'purchase', { properties: { revenue: '129.90', plan: 'pro' } }),
        ],
      }),
      headers: {
        'content-type': 'text/plain;charset=UTF-8',
        'user-agent': SAFARI_IPHONE,
        [E2E_CLIENT_IP_HEADER]: '198.51.100.201',
        origin: SITE,
      },
    });
    expect(batch.statusCode).toBe(202);
    expect(batch.json()).toMatchObject({ accepted: 3, rejected: 0 });
    const stored = await owner<{ properties: Record<string, unknown> }[]>`
      SELECT properties FROM events WHERE project_id = ${projectId} AND name = 'purchase'
      ORDER BY occurred_at`;
    expect(stored.map(({ properties }) => properties)).toEqual([
      { revenue: 129.9, plan: 'pro' },
      { plan: 'pro' },
    ]);

    const overview = await call('GET', `/v1/projects/${projectId}/overview?${RANGE}`);
    const summary = await call('GET', `/v1/projects/${projectId}/goals/summary?${RANGE}`);
    const acquisition = await call('GET', `/v1/projects/${projectId}/acquisition?${RANGE}`);

    expect(overview.json()).toMatchObject({
      kpis: { conversions: { current: 2 }, revenue: { current: 129.9, previous: 0 } },
    });
    expect(summary.json()).toMatchObject({ goals: [{ conversions: 2, revenue: 129.9 }] });
    expect(acquisition.json<{ channels: unknown[] }>().channels).toHaveLength(7);
  });
});
