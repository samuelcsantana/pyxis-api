import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import postgres from 'postgres';
import { sha256Hex } from '../../src/domain/auth/hashing';
import { CLOCK } from '../../src/domain/services/clock';
import { SESSION_COOKIE_NAME } from '../../src/infra/http/auth/session-cookie';
import { FixedClock } from '../../src/test-utils/fixed-clock';
import { createTestApp } from './create-test-app';
import { e2eOwnerUrl } from './e2e-database';

const NOW = new Date('2026-10-05T15:00:00.000Z');
const SHOP_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c01';
const FOREIGN_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c02';
const ADMIN_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c03';
const OTHER_ADMIN_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c04';
const SESSION_TOKEN = 'e2e-property-breakdown-session-token';
const FIRST_VISIT = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c05';
const SECOND_VISIT = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c06';
const RANGE = 'from=2026-10-04&to=2026-10-05';

describe('event property breakdown', () => {
  let app: NestFastifyApplication;
  let owner: postgres.Sql;

  const get = (path: string, cookie: string | null = `${SESSION_COOKIE_NAME}=${SESSION_TOKEN}`) =>
    app.inject({ method: 'GET', url: path, headers: cookie === null ? {} : { cookie } });

  beforeAll(async () => {
    owner = postgres(e2eOwnerUrl(), { max: 1, onnotice: () => undefined });
    await owner`
      INSERT INTO projects (id, name, allowed_origins, timezone, conversion_event)
      VALUES (${SHOP_ID}, 'Breakdown Shop', ${['https://shop.example.com']}, 'UTC', NULL),
             (${FOREIGN_ID}, 'Breakdown elsewhere', ${['https://else.example.com']}, 'UTC', NULL)
    `;
    await owner`
      INSERT INTO admin_users (id, email)
      VALUES (${ADMIN_ID}, 'breakdown@example.com'), (${OTHER_ADMIN_ID}, 'breakdown-other@example.com')
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
      INSERT INTO events (id, project_id, occurred_at, received_at, name, session_id, path,
                          device_type, browser, os, properties)
      VALUES
        (gen_random_uuid(), ${SHOP_ID}, '2026-10-05T10:00:00Z', ${NOW}, 'calculator_result_shown',
         ${FIRST_VISIT}, '/calculator', 'mobile', 'safari', 'ios',
         '{"calculator":"ifood","used_plan_preset":true}'),
        (gen_random_uuid(), ${SHOP_ID}, '2026-10-05T10:05:00Z', ${NOW}, 'calculator_result_shown',
         ${FIRST_VISIT}, '/calculator', 'mobile', 'safari', 'ios', '{"calculator":"99food"}'),
        (gen_random_uuid(), ${SHOP_ID}, '2026-10-04T09:00:00Z', ${NOW}, 'calculator_result_shown',
         ${SECOND_VISIT}, '/calculator', 'desktop', 'chrome', 'windows', '{"calculator":"ifood"}'),
        (gen_random_uuid(), ${FOREIGN_ID}, '2026-10-05T10:00:00Z', ${NOW},
         'calculator_result_shown', ${SECOND_VISIT}, '/calculator', 'desktop', 'chrome', 'windows',
         '{"calculator":"ifood"}')
    `;
    app = await createTestApp((builder) =>
      builder.overrideProvider(CLOCK).useValue(new FixedClock(NOW)),
    );
  });

  afterAll(async () => {
    await app.close();
    await owner.end();
  });

  it('breaks the properties of one event down by key, the most counted value first', async () => {
    const response = await get(
      `/v1/projects/${SHOP_ID}/features/properties?${RANGE}&name=calculator_result_shown`,
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      name: 'calculator_result_shown',
      events: 3,
      keys: [
        {
          key: 'calculator',
          events: 3,
          values: [
            { value: 'ifood', count: 2, visits: 2 },
            { value: '99food', count: 1, visits: 1 },
          ],
          other_count: 0,
        },
        {
          key: 'used_plan_preset',
          events: 1,
          values: [{ value: 'true', count: 1, visits: 1 }],
          other_count: 0,
        },
      ],
    });
  });

  it('answers no keys for an event the project never received', async () => {
    const response = await get(`/v1/projects/${SHOP_ID}/features/properties?${RANGE}&name=nothing`);

    expect(response.json()).toEqual({ name: 'nothing', events: 0, keys: [] });
  });

  it.each([
    ['without a session', `/v1/projects/${SHOP_ID}/features/properties?${RANGE}&name=x`, null, 401],
    [
      'for a project of another admin',
      `/v1/projects/${FOREIGN_ID}/features/properties?${RANGE}&name=calculator_result_shown`,
      `${SESSION_COOKIE_NAME}=${SESSION_TOKEN}`,
      404,
    ],
    [
      'for a name that is not an event name',
      `/v1/projects/${SHOP_ID}/features/properties?${RANGE}&name=Not-An-Event`,
      `${SESSION_COOKIE_NAME}=${SESSION_TOKEN}`,
      400,
    ],
    [
      'without a name',
      `/v1/projects/${SHOP_ID}/features/properties?${RANGE}`,
      `${SESSION_COOKIE_NAME}=${SESSION_TOKEN}`,
      400,
    ],
  ])('refuses a request %s', async (_label, path, cookie, status) => {
    expect((await get(path, cookie)).statusCode).toBe(status);
  });
});
