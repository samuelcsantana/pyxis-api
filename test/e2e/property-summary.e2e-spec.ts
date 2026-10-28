import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import postgres from 'postgres';
import { sha256Hex } from '../../src/domain/auth/hashing';
import { CLOCK } from '../../src/domain/services/clock';
import { SESSION_COOKIE_NAME } from '../../src/infra/http/auth/session-cookie';
import { FixedClock } from '../../src/test-utils/fixed-clock';
import { createTestApp } from './create-test-app';
import { e2eOwnerUrl } from './e2e-database';

const NOW = new Date('2026-10-05T15:00:00.000Z');
const BLOG_ID = '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d01';
const FOREIGN_ID = '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d02';
const ADMIN_ID = '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d03';
const OTHER_ADMIN_ID = '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d04';
const SESSION_TOKEN = 'e2e-property-summary-session-token';
const PHONE_VISIT = '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d05';
const LAPTOP_VISIT = '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d06';
const RANGE = 'from=2026-10-04&to=2026-10-05';
const SUMMARY = `/v1/projects/${BLOG_ID}/features/properties/summary?${RANGE}`;

describe('numeric property summary', () => {
  let app: NestFastifyApplication;
  let owner: postgres.Sql;

  const get = (path: string, cookie: string | null = `${SESSION_COOKIE_NAME}=${SESSION_TOKEN}`) =>
    app.inject({ method: 'GET', url: path, headers: cookie === null ? {} : { cookie } });

  beforeAll(async () => {
    owner = postgres(e2eOwnerUrl(), { max: 1, onnotice: () => undefined });
    await owner`
      INSERT INTO projects (id, name, allowed_origins, timezone, conversion_event)
      VALUES (${BLOG_ID}, 'Summary Blog', ${['https://blog.example.com']}, 'UTC', NULL),
             (${FOREIGN_ID}, 'Summary elsewhere', ${['https://else.example.com']}, 'UTC', NULL)
    `;
    await owner`
      INSERT INTO admin_users (id, email)
      VALUES (${ADMIN_ID}, 'summary@example.com'), (${OTHER_ADMIN_ID}, 'summary-other@example.com')
    `;
    await owner`
      INSERT INTO admin_project_access (admin_user_id, project_id)
      VALUES (${ADMIN_ID}, ${BLOG_ID}), (${OTHER_ADMIN_ID}, ${FOREIGN_ID})
    `;
    await owner`
      INSERT INTO admin_sessions (admin_user_id, token_hash, created_at, last_used_at)
      VALUES (${ADMIN_ID}, ${sha256Hex(SESSION_TOKEN)}, ${NOW}, ${NOW})
    `;
    await owner`
      INSERT INTO events (id, project_id, occurred_at, received_at, name, session_id, path,
                          device_type, browser, os, properties)
      VALUES
        (gen_random_uuid(), ${BLOG_ID}, '2026-10-05T10:00:00Z', ${NOW}, 'article_read_100',
         ${PHONE_VISIT}, '/blog/a', 'mobile', 'safari', 'ios', '{"seconds":30,"post":"a"}'),
        (gen_random_uuid(), ${BLOG_ID}, '2026-10-05T10:05:00Z', ${NOW}, 'article_read_100',
         ${PHONE_VISIT}, '/blog/b', 'mobile', 'safari', 'ios', '{"seconds":90,"post":"b"}'),
        (gen_random_uuid(), ${BLOG_ID}, '2026-10-04T09:00:00Z', ${NOW}, 'article_read_100',
         ${LAPTOP_VISIT}, '/blog/a', 'desktop', 'chrome', 'windows', '{"seconds":50,"post":"a"}'),
        (gen_random_uuid(), ${BLOG_ID}, '2026-10-04T09:05:00Z', ${NOW}, 'article_read_100',
         ${LAPTOP_VISIT}, '/blog/c', 'desktop', 'chrome', 'windows', '{"seconds":"long","post":"c"}'),
        (gen_random_uuid(), ${FOREIGN_ID}, '2026-10-05T10:00:00Z', ${NOW}, 'article_read_100',
         ${LAPTOP_VISIT}, '/blog/a', 'desktop', 'chrome', 'windows', '{"seconds":10,"post":"a"}')
    `;
    app = await createTestApp((builder) =>
      builder.overrideProvider(CLOCK).useValue(new FixedClock(NOW)),
    );
  });

  afterAll(async () => {
    await app.close();
    await owner.end();
  });

  it('answers the median and the quartiles of a numeric property, split by another', async () => {
    const response = await get(`${SUMMARY}&name=article_read_100&key=seconds&by=post`);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      name: 'article_read_100',
      key: 'seconds',
      by: 'post',
      overall: { events: 3, median: 50, p25: 40, p75: 70 },
      groups: [
        { value: 'a', events: 2, median: 40, p25: 35, p75: 45 },
        { value: 'b', events: 1, median: 90, p25: 90, p75: 90 },
      ],
      other_count: 0,
    });
  });

  it('answers the whole without a split, and within the visits the filters select', async () => {
    const whole = await get(`${SUMMARY}&name=article_read_100&key=seconds`);
    const phone = await get(`${SUMMARY}&name=article_read_100&key=seconds&device=mobile`);

    expect(whole.json()).toMatchObject({ by: null, groups: [], other_count: 0 });
    expect(phone.json()).toMatchObject({ overall: { events: 2, median: 60, p25: 45, p75: 75 } });
  });

  it('answers no figures for a property that is never a number', async () => {
    const response = await get(`${SUMMARY}&name=article_read_100&key=post`);

    expect(response.json()).toMatchObject({
      overall: { events: 0, median: null, p25: null, p75: null },
    });
  });

  it.each([
    ['without a session', `${SUMMARY}&name=article_read_100&key=seconds`, null, 401],
    [
      'for a project of another admin',
      `/v1/projects/${FOREIGN_ID}/features/properties/summary?${RANGE}&name=article_read_100&key=seconds`,
      `${SESSION_COOKIE_NAME}=${SESSION_TOKEN}`,
      404,
    ],
    [
      'for a key that is not a property key',
      `${SUMMARY}&name=article_read_100&key=Seconds`,
      `${SESSION_COOKIE_NAME}=${SESSION_TOKEN}`,
      400,
    ],
    [
      'without a key',
      `${SUMMARY}&name=article_read_100`,
      `${SESSION_COOKIE_NAME}=${SESSION_TOKEN}`,
      400,
    ],
  ])('refuses a request %s', async (_label, path, cookie, status) => {
    expect((await get(path, cookie)).statusCode).toBe(status);
  });
});
