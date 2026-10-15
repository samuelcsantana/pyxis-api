import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import postgres from 'postgres';
import { sha256Hex } from '../../src/domain/auth/hashing';
import { CLOCK } from '../../src/domain/services/clock';
import { SESSION_COOKIE_NAME } from '../../src/infra/http/auth/session-cookie';
import { FixedClock } from '../../src/test-utils/fixed-clock';
import { createTestApp } from './create-test-app';
import { e2eOwnerUrl } from './e2e-database';
import { E2E_DASHBOARD_ORIGIN } from './env-setup';

const NOW = new Date('2026-11-23T15:00:00.000Z');
const OWNER_ID = 'b2c3d4e5-f6a7-4b81-9c02-d3e4f5a6b701';
const ACCOUNT_ID = 'b2c3d4e5-f6a7-4b81-9c02-d3e4f5a6b711';
const HELD_ID = 'b2c3d4e5-f6a7-4b81-9c02-d3e4f5a6b721';
const FREE_ID = 'b2c3d4e5-f6a7-4b81-9c02-d3e4f5a6b722';
const SESSION = 'e2e-project-deletion-hold-owner';

describe('a project whose deletion the operator holds', () => {
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
    await owner`
      INSERT INTO admin_users (id, email) VALUES (${OWNER_ID}, 'held-project-owner@example.com')
    `;
    await owner`
      INSERT INTO accounts (id, owner_admin_id, status) VALUES (${ACCOUNT_ID}, ${OWNER_ID}, 'comped')
    `;
    await owner`
      INSERT INTO projects (id, name, account_id, deletion_held_at, deletion_hold_reason)
      VALUES (${HELD_ID}, 'Held shop', ${ACCOUNT_ID}, ${NOW}, 'Court order'),
             (${FREE_ID}, 'Free blog', ${ACCOUNT_ID}, NULL, NULL)
    `;
    await owner`
      INSERT INTO admin_project_access (admin_user_id, project_id)
      VALUES (${OWNER_ID}, ${HELD_ID}), (${OWNER_ID}, ${FREE_ID})
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
    await owner`DELETE FROM projects WHERE id IN (${HELD_ID}, ${FREE_ID})`;
    await owner`DELETE FROM accounts WHERE id = ${ACCOUNT_ID}`;
    await owner`DELETE FROM admin_users WHERE id = ${OWNER_ID}`;
    await owner.end();
  });

  it('shows the hold in the project settings, without the reason', async () => {
    const held = await asOwner('GET', `/v1/projects/${HELD_ID}/settings`);
    const free = await asOwner('GET', `/v1/projects/${FREE_ID}/settings`);

    expect(held.json()).toMatchObject({ deletion_held_at: NOW.toISOString() });
    expect(held.body).not.toContain('Court order');
    expect(free.json()).toMatchObject({ deletion_held_at: null });
  });

  it('refuses to delete the held project with 409 deletion_on_hold, and deletes the other', async () => {
    const refused = await asOwner('POST', `/v1/projects/${HELD_ID}/delete`, {
      confirm_name: 'Held shop',
    });
    const deleted = await asOwner('POST', `/v1/projects/${FREE_ID}/delete`, {
      confirm_name: 'Free blog',
    });

    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toMatchObject({ error: 'deletion_on_hold' });
    expect(deleted.statusCode).toBe(200);
    const left = await owner<{ id: string }[]>`
      SELECT id FROM projects WHERE id IN (${HELD_ID}, ${FREE_ID})
    `;
    expect(left).toEqual([{ id: HELD_ID }]);
  });
});
