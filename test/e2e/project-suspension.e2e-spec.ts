import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import postgres from 'postgres';
import { sha256Hex } from '../../src/domain/auth/hashing';
import { PUBLIC_KEY_PREFIX } from '../../src/domain/keys/project-keys';
import { CLOCK } from '../../src/domain/services/clock';
import { MAIL_SENDER } from '../../src/domain/services/mail-sender';
import { SESSION_COOKIE_NAME } from '../../src/infra/http/auth/session-cookie';
import { PROJECT_ACCOUNT_STATE_CACHE_TTL_MS } from '../../src/infra/repositories/drizzle-project-account-state.repository';
import { FixedClock } from '../../src/test-utils/fixed-clock';
import { RecordingMailSender } from '../../src/test-utils/recording-mail-sender';
import { createTestApp } from './create-test-app';
import { e2eOwnerUrl } from './e2e-database';
import { E2E_CLIENT_IP_HEADER, E2E_DASHBOARD_ORIGIN } from './env-setup';

const NOW = new Date('2026-11-21T15:00:00.000Z');
const OWNER_ID = 'a1b2c3d4-e5f6-4a71-8b92-c3d4e5f6a701';
const MEMBER_ID = 'a1b2c3d4-e5f6-4a71-8b92-c3d4e5f6a702';
const ACCOUNT_ID = 'a1b2c3d4-e5f6-4a71-8b92-c3d4e5f6a711';
const SHOP_ID = 'a1b2c3d4-e5f6-4a71-8b92-c3d4e5f6a721';
const OWNER_SESSION = 'e2e-project-suspension-owner';
const MEMBER_SESSION = 'e2e-project-suspension-member';
const ORIGIN = 'https://project-suspended.example.com';
const PUBLIC_KEY = `${PUBLIC_KEY_PREFIX}${'P'.repeat(32)}`;
const REASON = 'Events carried e-mail addresses';
const RANGE = 'from=2026-11-20&to=2026-11-21';
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';

let addressCounter = 0;

function nextAddress(): string {
  addressCounter += 1;
  return `198.51.100.${String(100 + addressCounter)}`;
}

describe('a project whose reception the operator suspended', () => {
  let app: NestFastifyApplication;
  let owner: postgres.Sql;
  const clock = new FixedClock(NOW);

  const dashboard = (url: string, session = OWNER_SESSION) =>
    app.inject({
      method: 'GET',
      url,
      headers: {
        origin: E2E_DASHBOARD_ORIGIN,
        cookie: `${SESSION_COOKIE_NAME}=${session}`,
      },
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
            id: `8f1c2b3a-1d2e-4f5a-8b6c-${String(index).padStart(12, '0')}`,
            name: 'page_view',
            occurred_at: clock.now().toISOString(),
            session_id: '1b7e1c2d-3f4a-4b5c-9d6e-7f8a9b0c1d2e',
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

  beforeAll(async () => {
    owner = postgres(e2eOwnerUrl(), { max: 1, onnotice: () => undefined });
    await owner`
      INSERT INTO admin_users (id, email, email_language)
      VALUES (${OWNER_ID}, 'project-suspended-owner@example.com', 'en'),
             (${MEMBER_ID}, 'project-suspended-member@example.com', 'en')
    `;
    await owner`
      INSERT INTO accounts (id, owner_admin_id, status) VALUES (${ACCOUNT_ID}, ${OWNER_ID}, 'comped')
    `;
    await owner`
      INSERT INTO projects (id, name, allowed_origins, account_id, timezone,
                            ingestion_suspended_at, ingestion_suspension_reason)
      VALUES (${SHOP_ID}, 'Suspended reception', ${[ORIGIN]}, ${ACCOUNT_ID}, 'UTC', ${NOW},
              ${REASON})
    `;
    await owner`
      INSERT INTO project_keys (project_id, kind, public_key) VALUES (${SHOP_ID}, 'public', ${PUBLIC_KEY})
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
    await owner`DELETE FROM admin_users WHERE id IN (${OWNER_ID}, ${MEMBER_ID})`;
    await owner.end();
  });

  it('refuses its batches with 403 project_suspended, readable by the site, and stores nothing', async () => {
    const refused = await sendBatch(1);

    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toMatchObject({ status_code: 403, error: 'project_suspended' });
    expect(refused.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(refused.headers.vary).toBe('Origin');
    const stored = await owner`SELECT id FROM events WHERE project_id = ${SHOP_ID}`;
    expect(stored).toHaveLength(0);
  });

  it('keeps its screens open and tells the owner, and only the owner, why', async () => {
    const overview = await dashboard(`/v1/projects/${SHOP_ID}/overview?${RANGE}`);
    const settings = await dashboard(`/v1/projects/${SHOP_ID}/settings`);
    const ownerMe = await dashboard('/v1/me');
    const memberMe = await dashboard('/v1/me', MEMBER_SESSION);

    expect(overview.statusCode).toBe(200);
    expect(settings.json()).toMatchObject({
      ingestion_suspended_at: NOW.toISOString(),
      ingestion_suspension_reason: REASON,
    });
    expect(ownerMe.json()).toMatchObject({
      projects: [
        {
          id: SHOP_ID,
          ingestion_suspended_at: NOW.toISOString(),
          ingestion_suspension_reason: REASON,
        },
      ],
    });
    expect(memberMe.json()).toMatchObject({
      projects: [
        {
          id: SHOP_ID,
          ingestion_suspended_at: NOW.toISOString(),
          ingestion_suspension_reason: null,
        },
      ],
    });
  });

  it('takes batches again within a minute of the suspension being lifted', async () => {
    await owner`
      UPDATE projects SET ingestion_suspended_at = NULL, ingestion_suspension_reason = NULL
      WHERE id = ${SHOP_ID}
    `;
    clock.advanceBy(PROJECT_ACCOUNT_STATE_CACHE_TTL_MS);

    const batch = await sendBatch(2);

    expect(batch.statusCode).toBe(202);
  });
});
