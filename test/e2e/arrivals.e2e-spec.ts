import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import postgres from 'postgres';
import { sha256Hex } from '../../src/domain/auth/hashing';
import { CLOCK } from '../../src/domain/services/clock';
import { SESSION_COOKIE_NAME } from '../../src/infra/http/auth/session-cookie';
import { ARRIVALS_REQUESTS_PER_WINDOW } from '../../src/infra/http/rate-limit/rate-limits';
import { FixedClock } from '../../src/test-utils/fixed-clock';
import { createTestApp } from './create-test-app';
import { e2eOwnerUrl } from './e2e-database';

const NOW = new Date('2026-10-23T17:05:12.000Z');
const SHOP_ID = 'a7b8c9d0-e1f2-4a3b-8c4d-5e6f7a8b9c0d';
const DOCS_ID = 'b8c9d0e1-f2a3-4b4c-9d5e-6f7a8b9c0d1e';
const FOREIGN_ID = 'c9d0e1f2-a3b4-4c5d-8e6f-7a8b9c0d1e2f';
const ADMIN_ID = 'd0e1f2a3-b4c5-4d6e-9f7a-8b9c0d1e2f3a';
const OTHER_ADMIN_ID = 'e1f2a3b4-c5d6-4e7f-8a8b-9c0d1e2f3a4b';
const SESSION_TOKEN = 'e2e-arrivals-session-token';
const SECOND_SESSION_TOKEN = 'e2e-arrivals-second-session-token';
const LIMITED_SESSION_TOKEN = 'e2e-arrivals-limited-session-token';
const VISIT_ID = 'f2a3b4c5-d6e7-4f8a-9b9c-0d1e2f3a4b5c';
const OLD_VISIT_ID = 'a3b4c5d6-e7f8-4a9b-8c0d-1e2f3a4b5c6d';

const cookieOf = (token: string) => `${SESSION_COOKIE_NAME}=${token}`;

describe('arrivals', () => {
  let app: NestFastifyApplication;
  let owner: postgres.Sql;

  const get = (path: string, cookie: string | null = cookieOf(SESSION_TOKEN)) =>
    app.inject({ method: 'GET', url: path, headers: cookie === null ? {} : { cookie } });

  beforeAll(async () => {
    owner = postgres(e2eOwnerUrl(), { max: 1, onnotice: () => undefined });
    await owner`
      INSERT INTO projects (id, name, allowed_origins, timezone, conversion_event)
      VALUES (${SHOP_ID}, 'Arrivals Shop', ${['https://shop.example.com']}, 'America/Sao_Paulo',
              'signup_completed'),
             (${DOCS_ID}, 'Arrivals Docs', ${['https://docs.example.com']}, 'UTC', NULL),
             (${FOREIGN_ID}, 'Someone else', ${['https://else.example.com']}, 'UTC', NULL)
    `;
    await owner`
      INSERT INTO admin_users (id, email)
      VALUES (${ADMIN_ID}, 'arrivals@example.com'), (${OTHER_ADMIN_ID}, 'other-arrivals@example.com')
    `;
    await owner`
      INSERT INTO admin_project_access (admin_user_id, project_id)
      VALUES (${ADMIN_ID}, ${SHOP_ID}), (${ADMIN_ID}, ${DOCS_ID}), (${OTHER_ADMIN_ID}, ${FOREIGN_ID})
    `;
    await owner`
      INSERT INTO admin_sessions (admin_user_id, token_hash, created_at, last_used_at)
      VALUES (${ADMIN_ID}, ${sha256Hex(SESSION_TOKEN)}, ${NOW}, ${NOW}),
             (${ADMIN_ID}, ${sha256Hex(SECOND_SESSION_TOKEN)}, ${NOW}, ${NOW}),
             (${ADMIN_ID}, ${sha256Hex(LIMITED_SESSION_TOKEN)}, ${NOW}, ${NOW})
    `;
    await owner`
      INSERT INTO events (id, project_id, occurred_at, received_at, name, session_id, path,
                          device_type, browser, os, channel, properties)
      VALUES
        (gen_random_uuid(), ${SHOP_ID}, '2026-10-23T17:01:00Z', '2026-10-23T17:01:00.400Z',
         'page_view', ${VISIT_ID}, '/pricing', 'desktop', 'chrome', 'macos', 'direct', '{}'),
        (gen_random_uuid(), ${SHOP_ID}, '2026-10-23T17:02:00Z', '2026-10-23T17:02:00Z',
         'signup_completed', ${VISIT_ID}, '/pricing', 'desktop', 'chrome', 'macos', NULL, '{}'),
        (gen_random_uuid(), ${SHOP_ID}, '2026-10-23T17:03:00Z', '2026-10-23T17:03:00Z',
         'api_request', ${VISIT_ID}, '/pricing', 'desktop', 'chrome', 'macos', NULL,
         '{"method":"GET","route":"/v1/plans","status":500,"duration_ms":40}'),
        (gen_random_uuid(), ${SHOP_ID}, '2026-10-14T12:00:00Z', '2026-10-14T12:00:05Z',
         'page_view', ${OLD_VISIT_ID}, '/', 'mobile', 'safari', 'ios', 'direct', '{}'),
        (gen_random_uuid(), ${DOCS_ID}, '2026-10-23T17:04:00Z', '2026-10-23T17:04:00Z',
         'page_view', ${OLD_VISIT_ID}, '/', 'mobile', 'safari', 'ios', 'direct', '{}')
    `;
    app = await createTestApp((builder) =>
      builder.overrideProvider(CLOCK).useValue(new FixedClock(NOW)),
    );
  });

  afterAll(async () => {
    await app.close();
    await owner.end();
  });

  it('answers what arrived since the moment, kind by kind, with the visits active now', async () => {
    const response = await get(
      `/v1/projects/${SHOP_ID}/arrivals?from=2026-10-23&to=2026-10-23&since=2026-10-23T17:00:00Z`,
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      as_of: '2026-10-23T17:05:12.000Z',
      active_visits: 1,
      visits: { times: ['2026-10-23T17:01:01.000Z'], more: false },
      conversions: { times: ['2026-10-23T17:02:00.000Z'], more: false },
      named_events: { times: ['2026-10-23T17:02:00.000Z'], more: false },
      failed_requests: { times: ['2026-10-23T17:03:00.000Z'], more: false },
    });
  });

  it('looks back at most 7 days, whatever moment it is given', async () => {
    const response = await get(
      `/v1/projects/${SHOP_ID}/arrivals?from=2026-09-24&to=2026-10-23&since=2026-09-01T00:00:00Z`,
    );

    expect(response.json()).toMatchObject({
      visits: { times: ['2026-10-23T17:01:01.000Z'], more: false },
    });
  });

  it('answers no conversions for a project without a conversion event', async () => {
    const response = await get(
      `/v1/projects/${DOCS_ID}/arrivals?from=2026-10-23&to=2026-10-23&since=2026-10-23T17:00:00Z`,
    );

    expect(response.json()).toMatchObject({
      conversions: null,
      visits: { times: ['2026-10-23T17:04:00.000Z'], more: false },
      active_visits: 1,
    });
  });

  it('answers not found for a project the admin may not read, and 401 without a session', async () => {
    const query = 'from=2026-10-23&to=2026-10-23&since=2026-10-23T17:00:00Z';

    expect((await get(`/v1/projects/${FOREIGN_ID}/arrivals?${query}`)).statusCode).toBe(404);
    expect((await get(`/v1/projects/${SHOP_ID}/arrivals?${query}`, null)).statusCode).toBe(401);
  });

  it('refuses a moment that is not a date and time, and an unknown parameter', async () => {
    const range = 'from=2026-10-23&to=2026-10-23';

    expect(
      (await get(`/v1/projects/${SHOP_ID}/arrivals?${range}&since=yesterday`)).statusCode,
    ).toBe(400);
    expect(
      (await get(`/v1/projects/${SHOP_ID}/arrivals?${range}&since=2026-10-23T17:00:00Z&x=1`))
        .statusCode,
    ).toBe(400);
  });

  it('limits each session to thirty asks a minute, and leaves the other reads alone', async () => {
    const path = `/v1/projects/${DOCS_ID}/arrivals?from=2026-10-23&to=2026-10-23&since=2026-10-23T17:00:00Z`;
    const statuses: number[] = [];
    for (let attempt = 0; attempt <= ARRIVALS_REQUESTS_PER_WINDOW; attempt += 1) {
      statuses.push((await get(path, cookieOf(LIMITED_SESSION_TOKEN))).statusCode);
    }

    expect(statuses.slice(0, ARRIVALS_REQUESTS_PER_WINDOW).every((status) => status === 200)).toBe(
      true,
    );
    expect(statuses.at(-1)).toBe(429);
    expect((await get(path, cookieOf(SECOND_SESSION_TOKEN))).statusCode).toBe(200);
    expect(
      (await get(`/v1/projects/${DOCS_ID}/overview?from=2026-10-23&to=2026-10-23`)).statusCode,
    ).toBe(200);
  });
});
