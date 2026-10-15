import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import postgres from 'postgres';
import { sha256Hex } from '../../src/domain/auth/hashing';
import {
  PUBLIC_KEY_PREFIX,
  SECRET_KEY_PREFIX,
  hashSecretKey,
} from '../../src/domain/keys/project-keys';
import { CLOCK } from '../../src/domain/services/clock';
import { MAIL_SENDER } from '../../src/domain/services/mail-sender';
import { SESSION_COOKIE_NAME } from '../../src/infra/http/auth/session-cookie';
import { PROJECT_ACCOUNT_STATE_CACHE_TTL_MS } from '../../src/infra/repositories/drizzle-project-account-state.repository';
import { FixedClock } from '../../src/test-utils/fixed-clock';
import { RecordingMailSender } from '../../src/test-utils/recording-mail-sender';
import { createTestApp } from './create-test-app';
import { e2eOwnerUrl } from './e2e-database';
import { E2E_CLIENT_IP_HEADER, E2E_DASHBOARD_ORIGIN } from './env-setup';

const NOW = new Date('2026-11-20T15:00:00.000Z');
const OWNER_ID = '7b8c9d0e-1f2a-4b3c-8d4e-5f6a7b8c9d01';
const ACCOUNT_ID = '7b8c9d0e-1f2a-4b3c-8d4e-5f6a7b8c9d11';
const SHOP_ID = '7b8c9d0e-1f2a-4b3c-8d4e-5f6a7b8c9d21';
const OWNER_EMAIL = 'suspended-owner@example.com';
const SESSION = 'e2e-suspension-owner-session';
const COOKIE = `${SESSION_COOKIE_NAME}=${SESSION}`;
const ORIGIN = 'https://suspended.example.com';
const PUBLIC_KEY = `${PUBLIC_KEY_PREFIX}${'S'.repeat(32)}`;
const SECRET_KEY = `${SECRET_KEY_PREFIX}${'T'.repeat(32)}`;
const RANGE = 'from=2026-11-19&to=2026-11-20';
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';

let addressCounter = 0;

function nextAddress(): string {
  addressCounter += 1;
  return `198.51.100.${String(200 + addressCounter)}`;
}

describe('an account suspended by the operator', () => {
  let app: NestFastifyApplication;
  let owner: postgres.Sql;
  const clock = new FixedClock(NOW);

  const dashboard = (
    method: 'GET' | 'POST' | 'PATCH',
    url: string,
    payload?: object,
    authorization?: string,
  ) =>
    app.inject({
      method,
      url,
      headers: {
        origin: E2E_DASHBOARD_ORIGIN,
        ...(authorization === undefined ? { cookie: COOKIE } : { authorization }),
      },
      ...(payload === undefined ? {} : { payload }),
    });

  const sendBatch = (index: number) =>
    app.inject({
      method: 'POST',
      url: '/v1/batch',
      payload: JSON.stringify({
        key: PUBLIC_KEY,
        sent_at: clock.now().toISOString(),
        events: [
          {
            id: `9f1c2b3a-1d2e-4f5a-8b6c-${String(index).padStart(12, '0')}`,
            name: 'page_view',
            occurred_at: clock.now().toISOString(),
            session_id: '0b7e1c2d-3f4a-4b5c-9d6e-7f8a9b0c1d2e',
            path: '/pricing',
          },
        ],
      }),
      headers: {
        'content-type': 'text/plain',
        'user-agent': SAFARI_IPHONE,
        origin: ORIGIN,
        [E2E_CLIENT_IP_HEADER]: nextAddress(),
      },
    });

  const setSuspended = async (suspended: boolean) => {
    await owner`
      UPDATE accounts
      SET suspended_at = ${suspended ? NOW : null},
          suspension_reason = ${suspended ? 'Forged traffic from another site' : null}
      WHERE id = ${ACCOUNT_ID}
    `;
    clock.advanceBy(PROJECT_ACCOUNT_STATE_CACHE_TTL_MS);
  };

  beforeAll(async () => {
    owner = postgres(e2eOwnerUrl(), { max: 1, onnotice: () => undefined });
    await owner`
      INSERT INTO admin_users (id, email, email_language) VALUES (${OWNER_ID}, ${OWNER_EMAIL}, 'en')
    `;
    await owner`
      INSERT INTO accounts (id, owner_admin_id, status, suspended_at, suspension_reason)
      VALUES (${ACCOUNT_ID}, ${OWNER_ID}, 'comped', ${NOW}, 'Forged traffic from another site')
    `;
    await owner`
      INSERT INTO projects (id, name, allowed_origins, account_id, timezone)
      VALUES (${SHOP_ID}, 'Suspended shop', ${[ORIGIN]}, ${ACCOUNT_ID}, 'UTC')
    `;
    await owner`
      INSERT INTO project_keys (project_id, kind, public_key, secret_hash)
      VALUES (${SHOP_ID}, 'public', ${PUBLIC_KEY}, NULL),
             (${SHOP_ID}, 'secret', NULL, ${hashSecretKey(SECRET_KEY)})
    `;
    await owner`
      INSERT INTO admin_project_access (admin_user_id, project_id) VALUES (${OWNER_ID}, ${SHOP_ID})
    `;
    await owner`
      INSERT INTO admin_sessions (admin_user_id, token_hash, created_at, last_used_at)
      VALUES (${OWNER_ID}, ${sha256Hex(SESSION)}, ${NOW}, ${NOW})
    `;
    app = await createTestApp((builder) =>
      builder
        .overrideProvider(CLOCK)
        .useValue(clock)
        .overrideProvider(MAIL_SENDER)
        .useValue(new RecordingMailSender()),
    );
  });

  afterAll(async () => {
    await app.close();
    await owner`DELETE FROM events WHERE project_id = ${SHOP_ID}`;
    await owner`DELETE FROM projects WHERE id = ${SHOP_ID}`;
    await owner`DELETE FROM accounts WHERE id = ${ACCOUNT_ID}`;
    await owner`DELETE FROM admin_users WHERE id = ${OWNER_ID}`;
    await owner.end();
  });

  it('refuses its batches with 403 account_suspended, readable by the site, and stores nothing', async () => {
    const refused = await sendBatch(1);

    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toMatchObject({ status_code: 403, error: 'account_suspended' });
    expect(refused.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(refused.headers.vary).toBe('Origin');
    const stored = await owner`SELECT id FROM events WHERE project_id = ${SHOP_ID}`;
    expect(stored).toHaveLength(0);
  });

  it('refuses its project screens to a session and to a read-only token, and its changes', async () => {
    const created = await dashboard('POST', '/v1/me/tokens', { name: 'Agent' });
    expect(created.statusCode).toBe(201);
    const { token } = created.json<{ token: string }>();

    const answers = [
      await dashboard('GET', `/v1/projects/${SHOP_ID}/overview?${RANGE}`),
      await dashboard(
        'GET',
        `/v1/projects/${SHOP_ID}/overview?${RANGE}`,
        undefined,
        `Bearer ${token}`,
      ),
      await dashboard('GET', `/v1/projects/${SHOP_ID}/settings`),
      await dashboard('PATCH', `/v1/projects/${SHOP_ID}`, { name: 'Renamed' }),
    ];

    expect(
      answers.map((answer) => [answer.statusCode, answer.json<{ error: string }>().error]),
    ).toEqual([
      [403, 'account_suspended'],
      [403, 'account_suspended'],
      [403, 'account_suspended'],
      [403, 'account_suspended'],
    ]);
  });

  it('still shows the owner the account with the reason, and keeps exports and billing open', async () => {
    const accounts = await dashboard('GET', '/v1/me/accounts');
    const missingExport = await dashboard(
      'GET',
      `/v1/projects/${SHOP_ID}/exports/00000000-0000-4000-8000-000000000000`,
    );
    const portal = await dashboard('POST', `/v1/accounts/${ACCOUNT_ID}/portal`, {});

    expect(accounts.statusCode).toBe(200);
    expect(accounts.json()).toEqual({
      accounts: [
        expect.objectContaining({
          id: ACCOUNT_ID,
          role: 'owner',
          suspended_at: NOW.toISOString(),
          suspension_reason: 'Forged traffic from another site',
        }),
      ],
    });
    expect(missingExport.json<{ error: string }>().error).toBe('export_not_found');
    expect(portal.json<{ error: string }>().error).toBe('no_billing_yet');
  });

  it("keeps the erasure and export of a person's events open to the secret key", async () => {
    const erased = await app.inject({
      method: 'DELETE',
      url: '/v1/subjects/ana',
      headers: { authorization: `Bearer ${SECRET_KEY}`, [E2E_CLIENT_IP_HEADER]: nextAddress() },
    });

    expect(erased.statusCode).toBe(200);
  });

  it('takes batches and opens the screens again within a minute of the suspension being lifted', async () => {
    await setSuspended(false);

    const batch = await sendBatch(2);
    const overview = await dashboard('GET', `/v1/projects/${SHOP_ID}/overview?${RANGE}`);

    expect(batch.statusCode).toBe(202);
    expect(overview.statusCode).toBe(200);
  });

  it('lets the owner close the account even while it is suspended', async () => {
    await setSuspended(true);

    const closed = await dashboard('POST', `/v1/accounts/${ACCOUNT_ID}/close`, {
      confirm_email: OWNER_EMAIL,
    });

    expect(closed.statusCode).toBe(200);
    const [row] = await owner<
      { status: string }[]
    >`SELECT status FROM accounts WHERE id = ${ACCOUNT_ID}`;
    expect(row?.status).toBe('ended');
  });
});
