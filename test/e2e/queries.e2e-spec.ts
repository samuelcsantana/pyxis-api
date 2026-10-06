import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import postgres from 'postgres';
import { sha256Hex } from '../../src/domain/auth/hashing';
import { CLOCK } from '../../src/domain/services/clock';
import { SESSION_COOKIE_NAME } from '../../src/infra/http/auth/session-cookie';
import { FixedClock } from '../../src/test-utils/fixed-clock';
import { createTestApp } from './create-test-app';
import { e2eOwnerUrl } from './e2e-database';

const NOW = new Date('2026-10-05T15:00:00.000Z');
const SHOP_ID = 'e4f5a6b7-c8d9-4ea0-8b1c-2d3e4f5a6b7c';
const FOREIGN_ID = 'f5a6b7c8-d9ea-4fb1-9c2d-3e4f5a6b7c8d';
const ADMIN_ID = 'a6b7c8d9-eafb-4c12-8d3e-4f5a6b7c8d9e';
const OTHER_ADMIN_ID = 'b7c8d9ea-fb0c-4d23-9e4f-5a6b7c8d9eaf';
const SESSION_TOKEN = 'e2e-queries-session-token';
const SESSION_ID = 'c8d9eafb-0c1d-4e34-8f5a-6b7c8d9eafb0';

describe('dashboard queries', () => {
  let app: NestFastifyApplication;
  let owner: postgres.Sql;

  const get = (path: string, cookie: string | null = `${SESSION_COOKIE_NAME}=${SESSION_TOKEN}`) =>
    app.inject({
      method: 'GET',
      url: path,
      headers: cookie === null ? {} : { cookie },
    });

  beforeAll(async () => {
    owner = postgres(e2eOwnerUrl(), { max: 1, onnotice: () => undefined });
    await owner`
      INSERT INTO projects (id, name, allowed_origins, timezone, conversion_event)
      VALUES (${SHOP_ID}, 'Queries Shop', ${['https://shop.example.com']}, 'UTC', 'signup_completed'),
             (${FOREIGN_ID}, 'Someone else', ${['https://else.example.com']}, 'UTC', NULL)
    `;
    await owner`
      INSERT INTO admin_users (id, email)
      VALUES (${ADMIN_ID}, 'queries@example.com'), (${OTHER_ADMIN_ID}, 'other@example.com')
    `;
    await owner`
      INSERT INTO admin_project_access (admin_user_id, project_id)
      VALUES (${ADMIN_ID}, ${SHOP_ID}), (${OTHER_ADMIN_ID}, ${FOREIGN_ID})
    `;
    await owner`
      INSERT INTO admin_sessions (admin_user_id, token_hash, created_at, last_used_at)
      VALUES (${ADMIN_ID}, ${sha256Hex(SESSION_TOKEN)}, ${NOW}, ${NOW})
    `;
    await owner`
      INSERT INTO events (id, project_id, occurred_at, received_at, name, session_id, user_id, path,
                          device_type, browser, os, properties)
      VALUES
        (gen_random_uuid(), ${SHOP_ID}, '2026-10-05T10:00:00Z', ${NOW}, 'page_view', ${SESSION_ID},
         NULL, '/pricing', 'desktop', 'chrome', 'macos', '{}'),
        (gen_random_uuid(), ${SHOP_ID}, '2026-10-05T10:01:00Z', ${NOW}, 'signup_completed',
         ${SESSION_ID}, 'u-1', '/pricing', 'desktop', 'chrome', 'macos', '{}'),
        (gen_random_uuid(), ${SHOP_ID}, '2026-10-05T10:02:00Z', ${NOW}, 'api_request',
         ${SESSION_ID}, 'u-1', '/pricing', 'desktop', 'chrome', 'macos',
         '{"method":"POST","route":"/v1/plans","status":503,"duration_ms":80}'),
        (gen_random_uuid(), ${FOREIGN_ID}, '2026-10-05T10:00:00Z', ${NOW}, 'page_view',
         ${SESSION_ID}, NULL, '/', 'desktop', 'chrome', 'macos', '{}')
    `;
    app = await createTestApp((builder) =>
      builder.overrideProvider(CLOCK).useValue(new FixedClock(NOW)),
    );
  });

  afterAll(async () => {
    await app.close();
    await owner.end();
  });

  it('answers the overview of a project the admin may read', async () => {
    const response = await get(`/v1/projects/${SHOP_ID}/overview?from=2026-10-04&to=2026-10-05`);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      kpis: {
        visits: { current: 1, previous: 0, daily: [0, 1] },
        identified_users: { current: 1, previous: 0, daily: [0, 1] },
        conversions: { current: 1, previous: 0, daily: [0, 1] },
        write_errors: {
          current: { failed: 1, total: 1 },
          previous: { failed: 0, total: 0 },
          daily: [
            { failed: 0, total: 0 },
            { failed: 1, total: 1 },
          ],
        },
      },
      days: [
        { date: '2026-10-04', page_views: 0, events: 0 },
        { date: '2026-10-05', page_views: 1, events: 1 },
      ],
      top_pages: [{ path: '/pricing', views: 1, visits: 1 }],
      top_events: [{ name: 'signup_completed', count: 1, visits: 1 }],
    });
  });

  it.each([
    ['a project of another admin', FOREIGN_ID],
    ['a project that does not exist', '00000000-0000-4000-8000-000000000000'],
    ['a project id that is not a UUID', 'not-a-uuid'],
  ])('answers 404 not_found to %s, the same way every time', async (_case, projectId) => {
    const response = await get(`/v1/projects/${projectId}/overview?from=2026-10-05&to=2026-10-05`);

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      status_code: 404,
      error: 'not_found',
      message: 'Nothing lives at this address.',
    });
  });

  it.each([
    ['a start after the end', 'from=2026-10-05&to=2026-10-04'],
    ['an end after today in the project zone', 'from=2026-10-05&to=2026-10-06'],
    ['more than 400 days', 'from=2025-08-31&to=2026-10-05'],
  ])('answers 400 invalid_range to %s', async (_case, query) => {
    const response = await get(`/v1/projects/${SHOP_ID}/overview?${query}`);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'invalid_range' });
  });

  it.each([
    ['a missing end', 'from=2026-10-05'],
    ['a date that is not one', 'from=2026-10-05&to=tomorrow'],
    ['an unknown parameter', 'from=2026-10-05&to=2026-10-05&tz=UTC'],
  ])('answers 400 invalid_request to %s', async (_case, query) => {
    const response = await get(`/v1/projects/${SHOP_ID}/overview?${query}`);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'invalid_request' });
  });

  it('answers 401 without a session', async () => {
    const response = await get(
      `/v1/projects/${SHOP_ID}/overview?from=2026-10-05&to=2026-10-05`,
      null,
    );

    expect(response.statusCode).toBe(401);
  });
});
