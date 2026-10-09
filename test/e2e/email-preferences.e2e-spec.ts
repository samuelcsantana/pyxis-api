import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import postgres from 'postgres';
import { sha256Hex } from '../../src/domain/auth/hashing';
import { CLOCK } from '../../src/domain/services/clock';
import { SESSION_COOKIE_NAME } from '../../src/infra/http/auth/session-cookie';
import { FixedClock } from '../../src/test-utils/fixed-clock';
import { createTestApp } from './create-test-app';
import { e2eOwnerUrl } from './e2e-database';

const NOW = new Date('2026-10-09T15:00:00.000Z');
const SHOP_ID = '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e01';
const FOREIGN_ID = '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e02';
const ADMIN_ID = '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e03';
const OTHER_ADMIN_ID = '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e04';
const SESSION_TOKEN = 'e2e-email-preferences-session-token';
const SESSION_COOKIE = `${SESSION_COOKIE_NAME}=${SESSION_TOKEN}`;

describe('e-mail preferences', () => {
  let app: NestFastifyApplication;
  let owner: postgres.Sql;

  const preferencesOf = (projectId: string) => `/v1/projects/${projectId}/email-preferences`;
  const get = (url: string, cookie: string | null = SESSION_COOKIE) =>
    app.inject({ method: 'GET', url, headers: cookie === null ? {} : { cookie } });
  const put = (url: string, payload: object, cookie: string | null = SESSION_COOKIE) =>
    app.inject({ method: 'PUT', url, payload, headers: cookie === null ? {} : { cookie } });

  beforeAll(async () => {
    owner = postgres(e2eOwnerUrl(), { max: 1, onnotice: () => undefined });
    await owner`
      INSERT INTO projects (id, name)
      VALUES (${SHOP_ID}, 'Preferences Shop'), (${FOREIGN_ID}, 'Preferences elsewhere')
    `;
    await owner`
      INSERT INTO admin_users (id, email)
      VALUES (${ADMIN_ID}, 'preferences@example.com'),
             (${OTHER_ADMIN_ID}, 'preferences-other@example.com')
    `;
    await owner`
      INSERT INTO admin_project_access (admin_user_id, project_id)
      VALUES (${ADMIN_ID}, ${SHOP_ID}), (${OTHER_ADMIN_ID}, ${SHOP_ID}),
             (${OTHER_ADMIN_ID}, ${FOREIGN_ID})
    `;
    await owner`
      INSERT INTO admin_sessions (admin_user_id, token_hash, created_at, last_used_at)
      VALUES (${ADMIN_ID}, ${sha256Hex(SESSION_TOKEN)}, ${NOW}, ${NOW})
    `;
    app = await createTestApp((builder) =>
      builder.overrideProvider(CLOCK).useValue(new FixedClock(NOW)),
    );
  });

  afterAll(async () => {
    await app.close();
    await owner.end();
  });

  it('sends the weekly digest until the admin turns it off, for that admin only', async () => {
    const before = await get(preferencesOf(SHOP_ID));
    expect(before.statusCode).toBe(200);
    expect(before.json()).toEqual({ weekly_digest: true });

    const turnedOff = await put(preferencesOf(SHOP_ID), { weekly_digest: false });
    expect(turnedOff.statusCode).toBe(200);
    expect(turnedOff.json()).toEqual({ weekly_digest: false });

    expect((await get(preferencesOf(SHOP_ID))).json()).toEqual({ weekly_digest: false });
    const rows = await owner<{ admin_user_id: string; weekly_digest: boolean }[]>`
      SELECT admin_user_id, weekly_digest FROM admin_project_access
      WHERE project_id = ${SHOP_ID} ORDER BY admin_user_id
    `;
    expect(rows).toEqual([
      { admin_user_id: ADMIN_ID, weekly_digest: false },
      { admin_user_id: OTHER_ADMIN_ID, weekly_digest: true },
    ]);

    const turnedOn = await put(preferencesOf(SHOP_ID), { weekly_digest: true });
    expect(turnedOn.json()).toEqual({ weekly_digest: true });
  });

  it.each([
    ['an unknown field', { weekly_digest: false, monthly_digest: true }],
    ['a value that is not a boolean', { weekly_digest: 'no' }],
    ['no value', {}],
  ])('refuses a body with %s and changes nothing', async (_label, payload) => {
    const response = await put(preferencesOf(SHOP_ID), payload);

    expect(response.statusCode).toBe(400);
    expect((await get(preferencesOf(SHOP_ID))).json()).toEqual({ weekly_digest: true });
  });

  it.each([
    ['to read without a session', () => get(preferencesOf(SHOP_ID), null), 401],
    [
      'to change without a session',
      () => put(preferencesOf(SHOP_ID), { weekly_digest: false }, null),
      401,
    ],
    ['to read a project of another admin', () => get(preferencesOf(FOREIGN_ID)), 404],
    [
      'to change a project of another admin',
      () => put(preferencesOf(FOREIGN_ID), { weekly_digest: false }),
      404,
    ],
    ['for a project id that is not a uuid', () => get(preferencesOf('not-a-uuid')), 404],
  ])('refuses %s', async (_label, send, status) => {
    expect((await send()).statusCode).toBe(status);
  });

  it('leaves the preferences of another admin alone after the refusals', async () => {
    const [row] = await owner<{ weekly_digest: boolean }[]>`
      SELECT weekly_digest FROM admin_project_access
      WHERE admin_user_id = ${OTHER_ADMIN_ID} AND project_id = ${FOREIGN_ID}
    `;
    expect(row?.weekly_digest).toBe(true);
  });
});
