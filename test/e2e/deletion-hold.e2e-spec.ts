import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import postgres from 'postgres';
import { sha256Hex } from '../../src/domain/auth/hashing';
import { CLOCK } from '../../src/domain/services/clock';
import { SESSION_COOKIE_NAME } from '../../src/infra/http/auth/session-cookie';
import { FixedClock } from '../../src/test-utils/fixed-clock';
import { createTestApp } from './create-test-app';
import { e2eOwnerUrl } from './e2e-database';
import { E2E_DASHBOARD_ORIGIN } from './env-setup';

const NOW = new Date('2026-11-22T15:00:00.000Z');
const OWNER_ID = '8c9d0e1f-2a3b-4c4d-8e5f-6a7b8c9d0e01';
const ACCOUNT_ID = '8c9d0e1f-2a3b-4c4d-8e5f-6a7b8c9d0e11';
const SHOP_ID = '8c9d0e1f-2a3b-4c4d-8e5f-6a7b8c9d0e21';
const SESSION = 'e2e-deletion-hold-owner-session';

describe('an account whose deletion the operator holds', () => {
  let app: NestFastifyApplication;
  let owner: postgres.Sql;

  const asOwner = (method: 'GET' | 'POST', url: string, payload?: object) =>
    app.inject({
      method,
      url,
      headers: { cookie: `${SESSION_COOKIE_NAME}=${SESSION}`, origin: E2E_DASHBOARD_ORIGIN },
      ...(payload === undefined ? {} : { payload }),
    });

  beforeAll(async () => {
    owner = postgres(e2eOwnerUrl(), { max: 1, onnotice: () => undefined });
    await owner`INSERT INTO admin_users (id, email) VALUES (${OWNER_ID}, 'held-owner@example.com')`;
    await owner`
      INSERT INTO accounts (id, owner_admin_id, status, deletion_held_at, deletion_hold_reason)
      VALUES (${ACCOUNT_ID}, ${OWNER_ID}, 'comped', ${NOW}, 'Court order')
    `;
    await owner`
      INSERT INTO projects (id, name, account_id) VALUES (${SHOP_ID}, 'Held shop', ${ACCOUNT_ID})
    `;
    await owner`
      INSERT INTO admin_project_access (admin_user_id, project_id) VALUES (${OWNER_ID}, ${SHOP_ID})
    `;
    await owner`
      INSERT INTO admin_sessions (admin_user_id, token_hash, created_at, last_used_at)
      VALUES (${OWNER_ID}, ${sha256Hex(SESSION)}, ${NOW}, ${NOW})
    `;
    app = await createTestApp((builder) =>
      builder.overrideProvider(CLOCK).useValue(new FixedClock(NOW)),
    );
  });

  afterAll(async () => {
    await app.close();
    await owner`DELETE FROM projects WHERE id = ${SHOP_ID}`;
    await owner`DELETE FROM accounts WHERE id = ${ACCOUNT_ID}`;
    await owner`DELETE FROM admin_users WHERE id = ${OWNER_ID}`;
    await owner.end();
  });

  it('shows the owner that the deletion is held, without the reason', async () => {
    const response = await asOwner('GET', '/v1/me/accounts');

    expect(response.json()).toEqual({
      accounts: [expect.objectContaining({ id: ACCOUNT_ID, deletion_held_at: NOW.toISOString() })],
    });
    expect(response.body).not.toContain('Court order');
  });

  it('refuses to delete a project of the account with 409 deletion_on_hold, keeping it', async () => {
    const response = await asOwner('POST', `/v1/projects/${SHOP_ID}/delete`, {
      confirm_name: 'Held shop',
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: 'deletion_on_hold' });
    const kept = await owner`SELECT id FROM projects WHERE id = ${SHOP_ID}`;
    expect(kept).toHaveLength(1);
  });
});
