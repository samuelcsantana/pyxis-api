import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import postgres from 'postgres';
import { sha256Hex } from '../../src/domain/auth/hashing';
import { CLOCK } from '../../src/domain/services/clock';
import { SESSION_COOKIE_NAME } from '../../src/infra/http/auth/session-cookie';
import { FixedClock } from '../../src/test-utils/fixed-clock';
import { createTestApp } from './create-test-app';
import { e2eOwnerUrl } from './e2e-database';
import { E2E_DASHBOARD_ORIGIN } from './env-setup';

const NOW = new Date('2026-10-14T15:00:00.000Z');
const SHOP_ID = '3d4e5f6a-7b8c-4d9e-8f0a-1b2c3d4e5f01';
const FOREIGN_ID = '3d4e5f6a-7b8c-4d9e-8f0a-1b2c3d4e5f02';
const ADMIN_ID = '3d4e5f6a-7b8c-4d9e-8f0a-1b2c3d4e5f03';
const OTHER_ADMIN_ID = '3d4e5f6a-7b8c-4d9e-8f0a-1b2c3d4e5f04';
const SESSION_TOKEN = 'e2e-access-tokens-session-token';
const SESSION_COOKIE = `${SESSION_COOKIE_NAME}=${SESSION_TOKEN}`;
const RANGE = 'from=2026-10-13&to=2026-10-14';

describe('read-only access tokens', () => {
  let app: NestFastifyApplication;
  let owner: postgres.Sql;

  const withSession = (method: 'GET' | 'POST' | 'DELETE', url: string, payload?: object) =>
    app.inject({
      method,
      url,
      headers: { cookie: SESSION_COOKIE, origin: E2E_DASHBOARD_ORIGIN },
      ...(payload === undefined ? {} : { payload }),
    });

  const withToken = (
    token: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    payload?: object,
  ) =>
    app.inject({
      method,
      url,
      headers: { authorization: `Bearer ${token}`, origin: E2E_DASHBOARD_ORIGIN },
      ...(payload === undefined ? {} : { payload }),
    });

  async function createToken(name = 'Claude Code'): Promise<{ id: string; token: string }> {
    const response = await withSession('POST', '/v1/me/tokens', { name });
    expect(response.statusCode).toBe(201);
    return response.json<{ id: string; token: string }>();
  }

  beforeAll(async () => {
    owner = postgres(e2eOwnerUrl(), { max: 1, onnotice: () => undefined });
    await owner`
      INSERT INTO projects (id, name, allowed_origins, timezone)
      VALUES (${SHOP_ID}, 'Token Shop', ${['https://shop.example.com']}, 'UTC'),
             (${FOREIGN_ID}, 'Not hers', ${['https://else.example.com']}, 'UTC')
    `;
    await owner`
      INSERT INTO admin_users (id, email)
      VALUES (${ADMIN_ID}, 'tokens@example.com'), (${OTHER_ADMIN_ID}, 'tokens-other@example.com')
    `;
    await owner`
      INSERT INTO admin_project_access (admin_user_id, project_id)
      VALUES (${ADMIN_ID}, ${SHOP_ID}), (${OTHER_ADMIN_ID}, ${FOREIGN_ID})
    `;
    await owner`
      INSERT INTO admin_sessions (admin_user_id, token_hash, created_at, last_used_at)
      VALUES (${ADMIN_ID}, ${sha256Hex(SESSION_TOKEN)}, ${NOW}, ${NOW})
    `;
    app = await createTestApp((builder) =>
      builder.overrideProvider(CLOCK).useValue(new FixedClock(NOW)),
    );
  });

  afterEach(async () => {
    await owner`DELETE FROM admin_access_tokens WHERE admin_user_id = ${ADMIN_ID}`;
  });

  afterAll(async () => {
    await app.close();
    await owner.end();
  });

  it('lets a session create a token, answered once, that then reads the granted project', async () => {
    const created = await createToken();

    expect(created.token).toMatch(/^pyxis_at_[A-Za-z0-9]{32}$/);
    const listed = await withSession('GET', '/v1/me/tokens');
    expect(listed.statusCode).toBe(200);
    expect(listed.body).not.toContain(created.token);
    expect(listed.json<{ tokens: { id: string }[] }>().tokens.map((token) => token.id)).toEqual([
      created.id,
    ]);

    const overview = await withToken(
      created.token,
      'GET',
      `/v1/projects/${SHOP_ID}/overview?${RANGE}`,
    );
    expect(overview.statusCode).toBe(200);
    const me = await withToken(created.token, 'GET', '/v1/me');
    expect(me.statusCode).toBe(200);
    expect(me.json<{ email: string }>().email).toBe('tokens@example.com');

    const [row] = await owner<{ last_used_at: Date | null }[]>`
      SELECT last_used_at FROM admin_access_tokens WHERE id = ${created.id}
    `;
    expect(row?.last_used_at).toEqual(NOW);
  });

  it("answers 404 for another admin's project, exactly as a session would", async () => {
    const { token } = await createToken();

    const response = await withToken(token, 'GET', `/v1/projects/${FOREIGN_ID}/overview?${RANGE}`);

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: 'not_found' });
  });

  it('never writes, signs in again or manages tokens', async () => {
    const { token } = await createToken();

    const refused = [
      await withToken(token, 'PUT', `/v1/projects/${SHOP_ID}/email-preferences`, {
        weekly_digest: false,
      }),
      await withToken(token, 'GET', `/v1/projects/${SHOP_ID}/email-preferences`),
      await withToken(token, 'GET', '/v1/me/tokens'),
      await withToken(token, 'POST', '/v1/me/tokens', { name: 'minted by a token' }),
      await withToken(token, 'GET', '/v1/me/sessions'),
      await withToken(token, 'POST', '/v1/auth/logout-all'),
    ];

    expect(refused.map((response) => response.statusCode)).toEqual([401, 401, 401, 401, 401, 401]);
    const [row] = await owner<{ total: number }[]>`
      SELECT count(*)::int AS total FROM admin_access_tokens WHERE admin_user_id = ${ADMIN_ID}
    `;
    expect(row?.total).toBe(1);
  });

  it('stops working the moment it is revoked', async () => {
    const created = await createToken();

    const revoked = await withSession('DELETE', `/v1/me/tokens/${created.id}`);
    const again = await withSession('DELETE', `/v1/me/tokens/${created.id}`);
    const read = await withToken(created.token, 'GET', `/v1/projects/${SHOP_ID}/overview?${RANGE}`);

    expect(revoked.statusCode).toBe(204);
    expect(again.statusCode).toBe(404);
    expect(read.statusCode).toBe(401);
  });

  it('refuses a secret key or a malformed bearer on the dashboard routes', async () => {
    const secretKey = `pyxis_sk_${'A'.repeat(32)}`;

    const responses = [
      await withToken(secretKey, 'GET', `/v1/projects/${SHOP_ID}/overview?${RANGE}`),
      await withToken('not-a-token', 'GET', '/v1/me'),
    ];

    expect(responses.map((response) => response.statusCode)).toEqual([401, 401]);
  });

  it('creates tokens only from the dashboard origin, with a valid body, ten at most', async () => {
    const foreign = await app.inject({
      method: 'POST',
      url: '/v1/me/tokens',
      headers: { cookie: SESSION_COOKIE, origin: 'https://evil.example.com' },
      payload: { name: 'from elsewhere' },
    });
    const invalid = await withSession('POST', '/v1/me/tokens', { name: '', expires_in_days: 7 });
    for (let index = 0; index < 10; index += 1) {
      await createToken(`agent ${String(index)}`);
    }
    const eleventh = await withSession('POST', '/v1/me/tokens', { name: 'one too many' });

    expect(foreign.statusCode).toBe(403);
    expect(invalid.statusCode).toBe(400);
    expect(eleventh.statusCode).toBe(409);
    expect(eleventh.json()).toMatchObject({ error: 'too_many_access_tokens' });
  });
});
