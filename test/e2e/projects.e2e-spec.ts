import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import postgres from 'postgres';
import { sha256Hex } from '../../src/domain/auth/hashing';
import { PUBLIC_KEY_PATTERN, SECRET_KEY_PATTERN } from '../../src/domain/keys/project-keys';
import { CLOCK } from '../../src/domain/services/clock';
import { SESSION_COOKIE_NAME } from '../../src/infra/http/auth/session-cookie';
import { FixedClock } from '../../src/test-utils/fixed-clock';
import { createTestApp } from './create-test-app';
import { e2eOwnerUrl } from './e2e-database';
import { E2E_DASHBOARD_ORIGIN } from './env-setup';

const NOW = new Date('2026-11-03T12:00:00.000Z');
const OWNER_ID = '3d4e5f6a-7b8c-4d9e-8f0a-1b2c3d4e5f01';
const STRANGER_ID = '3d4e5f6a-7b8c-4d9e-8f0a-1b2c3d4e5f02';
const ACCOUNT_ID = '3d4e5f6a-7b8c-4d9e-8f0a-1b2c3d4e5f11';
const OWNER_COOKIE = `${SESSION_COOKIE_NAME}=e2e-projects-owner-session`;
const STRANGER_COOKIE = `${SESSION_COOKIE_NAME}=e2e-projects-stranger-session`;
const SHOP = {
  name: 'Owned shop',
  allowed_origins: ['https://owned-shop.example.com'],
  timezone: 'America/Sao_Paulo',
};

interface Call {
  readonly cookie?: string | null;
  readonly origin?: string | null;
  readonly payload?: object;
}

describe('projects managed by the owner of their account', () => {
  let app: NestFastifyApplication;
  let owner: postgres.Sql;

  const call = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, options: Call = {}) => {
    const cookie = options.cookie === undefined ? OWNER_COOKIE : options.cookie;
    const origin = options.origin === undefined ? E2E_DASHBOARD_ORIGIN : options.origin;
    return app.inject({
      method,
      url,
      ...(options.payload === undefined ? {} : { payload: options.payload }),
      headers: {
        ...(cookie === null ? {} : { cookie }),
        ...(origin === null ? {} : { origin }),
      },
    });
  };

  const createProject = async (name = SHOP.name) => {
    const response = await call('POST', `/v1/accounts/${ACCOUNT_ID}/projects`, {
      payload: { ...SHOP, name },
    });
    if (response.statusCode !== 201) {
      throw new Error(`Unexpected answer ${String(response.statusCode)}: ${response.body}`);
    }
    return response.json<{ project_id: string; public_key: { id: string; key: string } }>();
  };

  const removeProjects = async () => {
    await owner`DELETE FROM projects WHERE account_id = ${ACCOUNT_ID}`;
  };

  beforeAll(async () => {
    owner = postgres(e2eOwnerUrl(), { max: 1, onnotice: () => undefined });
    await owner`
      INSERT INTO admin_users (id, email)
      VALUES (${OWNER_ID}, 'projects-owner@example.com'),
             (${STRANGER_ID}, 'projects-stranger@example.com')
    `;
    await owner`
      INSERT INTO accounts (id, owner_admin_id, status) VALUES (${ACCOUNT_ID}, ${OWNER_ID}, 'trialing')
    `;
    await owner`
      INSERT INTO admin_sessions (admin_user_id, token_hash, created_at, last_used_at)
      VALUES (${OWNER_ID}, ${sha256Hex('e2e-projects-owner-session')}, ${NOW}, ${NOW}),
             (${STRANGER_ID}, ${sha256Hex('e2e-projects-stranger-session')}, ${NOW}, ${NOW})
    `;
    app = await createTestApp((builder) =>
      builder.overrideProvider(CLOCK).useValue(new FixedClock(NOW)),
    );
  });

  beforeEach(async () => {
    await removeProjects();
    await owner`UPDATE accounts SET status = 'trialing' WHERE id = ${ACCOUNT_ID}`;
  });

  afterAll(async () => {
    await app.close();
    await removeProjects();
    await owner`DELETE FROM accounts WHERE id = ${ACCOUNT_ID}`;
    await owner`DELETE FROM admin_sessions WHERE admin_user_id IN (${OWNER_ID}, ${STRANGER_ID})`;
    await owner`DELETE FROM admin_users WHERE id IN (${OWNER_ID}, ${STRANGER_ID})`;
    await owner.end();
  });

  it('creates a project the owner can read at once, with its public key', async () => {
    const created = await createProject();

    expect(created.public_key.key).toMatch(PUBLIC_KEY_PATTERN);
    const me = await call('GET', '/v1/me');
    expect(me.json<{ projects: { id: string }[] }>().projects.map(({ id }) => id)).toContain(
      created.project_id,
    );
    const settings = await call('GET', `/v1/projects/${created.project_id}/settings`);
    expect(settings.statusCode).toBe(200);
    expect(settings.json()).toMatchObject({
      name: 'Owned shop',
      account_id: ACCOUNT_ID,
      role: 'owner',
      timezone: 'America/Sao_Paulo',
      allowed_origins: ['https://owned-shop.example.com'],
      city_enabled: false,
      public_keys: [{ id: created.public_key.id, key: created.public_key.key }],
    });
  });

  it('turns the city on and off, and shows it in the settings', async () => {
    const { project_id: projectId } = await createProject();

    const on = await call('PATCH', `/v1/projects/${projectId}`, {
      payload: { city_enabled: true },
    });
    const settingsWhileOn = await call('GET', `/v1/projects/${projectId}/settings`);
    const off = await call('PATCH', `/v1/projects/${projectId}`, {
      payload: { city_enabled: false },
    });
    const notBoolean = await call('PATCH', `/v1/projects/${projectId}`, {
      payload: { city_enabled: 'yes' },
    });

    expect(on.statusCode).toBe(200);
    expect(on.json()).toMatchObject({ id: projectId, city_enabled: true });
    expect(settingsWhileOn.json()).toMatchObject({ city_enabled: true });
    expect(off.json()).toMatchObject({ city_enabled: false });
    expect(notBoolean.statusCode).toBe(400);
  });

  it('changes the settings, and refuses an origin a browser would never send', async () => {
    const { project_id: projectId } = await createProject();

    const changed = await call('PATCH', `/v1/projects/${projectId}`, {
      payload: {
        name: 'Renamed shop',
        allowed_origins: ['https://renamed.example.com', 'http://localhost:5173'],
        conversion_event: 'signup_completed',
      },
    });
    const invalid = await call('PATCH', `/v1/projects/${projectId}`, {
      payload: { allowed_origins: ['https://renamed.example.com/pricing'] },
    });
    const tooMany = await call('PATCH', `/v1/projects/${projectId}`, {
      payload: {
        allowed_origins: Array.from(
          { length: 6 },
          (_, index) => `https://s${String(index)}.example.com`,
        ),
      },
    });

    expect(changed.statusCode).toBe(200);
    expect(changed.json()).toMatchObject({
      id: projectId,
      name: 'Renamed shop',
      allowed_origins: ['https://renamed.example.com', 'http://localhost:5173'],
      conversion_event: 'signup_completed',
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toMatchObject({ error: 'invalid_project_settings' });
    expect(tooMany.statusCode).toBe(400);
  });

  it('shows a secret key once, revokes keys of the project only and keeps the last public key', async () => {
    const shop = await createProject();
    const blog = await createProject('Owned blog');

    const secret = await call('POST', `/v1/projects/${shop.project_id}/keys`, {
      payload: { kind: 'secret' },
    });
    const secretKey = secret.json<{ id: string; key: string }>();
    const settings = await call('GET', `/v1/projects/${shop.project_id}/settings`);
    const lastPublic = await call(
      'DELETE',
      `/v1/projects/${shop.project_id}/keys/${shop.public_key.id}`,
    );
    const otherProjects = await call(
      'DELETE',
      `/v1/projects/${shop.project_id}/keys/${blog.public_key.id}`,
    );
    const revoked = await call('DELETE', `/v1/projects/${shop.project_id}/keys/${secretKey.id}`);

    expect(secret.statusCode).toBe(201);
    expect(secretKey.key).toMatch(SECRET_KEY_PATTERN);
    expect(settings.json()).toMatchObject({ secret_keys: [{ id: secretKey.id }] });
    expect(settings.body).not.toContain(secretKey.key);
    expect(lastPublic.statusCode).toBe(409);
    expect(lastPublic.json()).toMatchObject({ error: 'last_public_key' });
    expect(otherProjects.statusCode).toBe(404);
    expect(otherProjects.json()).toMatchObject({ error: 'key_not_found' });
    expect(revoked.statusCode).toBe(204);
    const [row] = await owner<{ revoked_at: Date | null }[]>`
      SELECT revoked_at FROM project_keys WHERE id = ${blog.public_key.id}
    `;
    expect(row?.revoked_at).toBeNull();
  });

  it('answers not found to anyone but the owner, and needs the dashboard and a session', async () => {
    const { project_id: projectId } = await createProject();

    const stranger = await call('PATCH', `/v1/projects/${projectId}`, {
      cookie: STRANGER_COOKIE,
      payload: { name: 'Mine now' },
    });
    const strangersProject = await call('POST', `/v1/accounts/${ACCOUNT_ID}/projects`, {
      cookie: STRANGER_COOKIE,
      payload: SHOP,
    });
    const elsewhere = await call('PATCH', `/v1/projects/${projectId}`, {
      origin: 'https://evil.example.com',
      payload: { name: 'Mine now' },
    });
    const anonymous = await call('PATCH', `/v1/projects/${projectId}`, {
      cookie: null,
      payload: { name: 'Mine now' },
    });

    expect(stranger.statusCode).toBe(404);
    expect(stranger.json()).toMatchObject({ error: 'project_not_found' });
    expect(strangersProject.statusCode).toBe(404);
    expect(strangersProject.json()).toMatchObject({ error: 'account_not_found' });
    expect(elsewhere.statusCode).toBe(403);
    expect(anonymous.statusCode).toBe(401);
  });

  it('refuses changes once the subscription has ended, but still deletes', async () => {
    const { project_id: projectId } = await createProject();
    await owner`UPDATE accounts SET status = 'ended' WHERE id = ${ACCOUNT_ID}`;

    const changed = await call('PATCH', `/v1/projects/${projectId}`, {
      payload: { name: 'Renamed' },
    });
    const created = await call('POST', `/v1/accounts/${ACCOUNT_ID}/projects`, { payload: SHOP });
    const mismatch = await call('POST', `/v1/projects/${projectId}/delete`, {
      payload: { confirm_name: 'owned shop' },
    });
    const deleted = await call('POST', `/v1/projects/${projectId}/delete`, {
      payload: { confirm_name: 'Owned shop' },
    });

    expect(changed.statusCode).toBe(409);
    expect(changed.json()).toMatchObject({ error: 'subscription_required' });
    expect(created.statusCode).toBe(409);
    expect(mismatch.statusCode).toBe(409);
    expect(mismatch.json()).toMatchObject({ error: 'project_name_mismatch' });
    expect(deleted.statusCode).toBe(200);
    expect(deleted.json()).toEqual({ project_id: projectId, deleted_events: 0, deleted_keys: 1 });
    expect(await owner`SELECT 1 FROM projects WHERE id = ${projectId}`).toHaveLength(0);
  });

  it("stops at the plan's three projects", async () => {
    await createProject('One');
    await createProject('Two');
    await createProject('Three');

    const fourth = await call('POST', `/v1/accounts/${ACCOUNT_ID}/projects`, { payload: SHOP });

    expect(fourth.statusCode).toBe(409);
    expect(fourth.json()).toMatchObject({ error: 'project_limit_reached' });
  });
});
