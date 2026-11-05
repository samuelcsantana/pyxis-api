import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import postgres from 'postgres';
import { sha256Hex } from '../../src/domain/auth/hashing';
import { CLOCK } from '../../src/domain/services/clock';
import { SESSION_COOKIE_NAME } from '../../src/infra/http/auth/session-cookie';
import { FixedClock } from '../../src/test-utils/fixed-clock';
import { createTestApp } from './create-test-app';
import { e2eOwnerUrl } from './e2e-database';
import { E2E_DASHBOARD_ORIGIN } from './env-setup';

const NOW = new Date('2026-11-04T15:00:00.000Z');
const OWNER_ID = 'e3a00000-0000-4000-8000-000000000001';
const STRANGER_ID = 'e3a00000-0000-4000-8000-000000000002';
const ACCOUNT_ID = 'e3a00000-0000-4000-8000-000000000011';
const MISSING_ID = 'ffffffff-ffff-4fff-bfff-ffffffffffff';
const OWNER_COOKIE = `${SESSION_COOKIE_NAME}=e2e-goals-owner-session`;
const STRANGER_COOKIE = `${SESSION_COOKIE_NAME}=e2e-goals-stranger-session`;
const BUYER = 'e3a00000-0000-4000-8000-000000000101';
const BROWSER = 'e3a00000-0000-4000-8000-000000000102';
const RANGE = 'from=2026-11-04&to=2026-11-04';

interface GoalBody {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly event: string | null;
  readonly path: string | null;
  readonly position: number;
}

interface Call {
  readonly cookie?: string;
  readonly payload?: object;
}

describe('goals of a project, over HTTP', () => {
  let app: NestFastifyApplication;
  let owner: postgres.Sql;
  let projectId = '';

  const call = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, options: Call = {}) =>
    app.inject({
      method,
      url,
      ...(options.payload === undefined ? {} : { payload: options.payload }),
      headers: { cookie: options.cookie ?? OWNER_COOKIE, origin: E2E_DASHBOARD_ORIGIN },
    });

  const goalsUrl = () => `/v1/projects/${projectId}/goals`;
  const listGoals = async () => (await call('GET', goalsUrl())).json<{ goals: GoalBody[] }>().goals;
  const overviewConversions = async (query = '') =>
    (await call('GET', `/v1/projects/${projectId}/overview?${RANGE}${query}`)).json<{
      kpis: { conversions: { current: number } | null };
    }>().kpis.conversions;

  beforeAll(async () => {
    owner = postgres(e2eOwnerUrl(), { max: 1, onnotice: () => undefined });
    await owner`
      INSERT INTO admin_users (id, email)
      VALUES (${OWNER_ID}, 'goals-owner@example.com'),
             (${STRANGER_ID}, 'goals-stranger@example.com')`;
    await owner`
      INSERT INTO accounts (id, owner_admin_id, status) VALUES (${ACCOUNT_ID}, ${OWNER_ID}, 'free')`;
    await owner`
      INSERT INTO admin_sessions (admin_user_id, token_hash, created_at, last_used_at)
      VALUES (${OWNER_ID}, ${sha256Hex('e2e-goals-owner-session')}, ${NOW}, ${NOW}),
             (${STRANGER_ID}, ${sha256Hex('e2e-goals-stranger-session')}, ${NOW}, ${NOW})`;
    app = await createTestApp((builder) =>
      builder.overrideProvider(CLOCK).useValue(new FixedClock(NOW)),
    );
    const created = await call('POST', `/v1/accounts/${ACCOUNT_ID}/projects`, {
      payload: {
        name: 'Goal shop',
        allowed_origins: ['https://goal-shop.example.com'],
        timezone: 'UTC',
        conversion_event: 'signup_completed',
      },
    });
    projectId = created.json<{ project_id: string }>().project_id;
    await owner`
      INSERT INTO events (id, project_id, occurred_at, received_at, name, session_id, path,
                          device_type, browser, os, properties)
      VALUES
        (gen_random_uuid(), ${projectId}, '2026-11-04T10:00:00Z', ${NOW}, 'page_view', ${BUYER},
         '/pricing', 'desktop', 'chrome', 'macos', '{}'),
        (gen_random_uuid(), ${projectId}, '2026-11-04T10:01:00Z', ${NOW}, 'signup_completed',
         ${BUYER}, '/pricing', 'desktop', 'chrome', 'macos', '{}'),
        (gen_random_uuid(), ${projectId}, '2026-11-04T10:02:00Z', ${NOW}, 'page_view', ${BUYER},
         '/thanks/order-1', 'desktop', 'chrome', 'macos', '{}'),
        (gen_random_uuid(), ${projectId}, '2026-11-04T11:00:00Z', ${NOW}, 'page_view', ${BROWSER},
         '/', 'mobile', 'safari', 'ios', '{}')`;
  });

  afterAll(async () => {
    await app.close();
    await owner`DELETE FROM projects WHERE account_id = ${ACCOUNT_ID}`;
    await owner`DELETE FROM accounts WHERE id = ${ACCOUNT_ID}`;
    await owner`DELETE FROM admin_sessions WHERE admin_user_id IN (${OWNER_ID}, ${STRANGER_ID})`;
    await owner`DELETE FROM admin_users WHERE id IN (${OWNER_ID}, ${STRANGER_ID})`;
    await owner.end();
  });

  it('turns the conversion event given at creation into goal 1, counted by default', async () => {
    expect(await listGoals()).toMatchObject([
      {
        name: 'signup_completed',
        type: 'event',
        event: 'signup_completed',
        path: null,
        position: 1,
      },
    ]);
    expect(await overviewConversions()).toMatchObject({ current: 1 });
  });

  it('adds a page goal, counts it when asked and summarizes both', async () => {
    const created = await call('POST', goalsUrl(), {
      payload: { name: 'Thanks page', path: '/thanks/*' },
    });
    expect(created.statusCode).toBe(201);
    const thanks = created.json<GoalBody>();
    expect(thanks).toMatchObject({ type: 'page', path: '/thanks/*', event: null, position: 2 });

    expect(await overviewConversions(`&goal=${thanks.id}`)).toMatchObject({ current: 1 });
    const summary = await call('GET', `${goalsUrl()}/summary?${RANGE}`);
    expect(summary.json()).toMatchObject({
      visits: 2,
      goals: [
        { name: 'signup_completed', conversions: 1, converting_visits: 1, conversion_rate: 0.5 },
        { name: 'Thanks page', conversions: 1, converting_visits: 1, conversion_rate: 0.5 },
      ],
    });
    const visits = await call(
      'GET',
      `/v1/projects/${projectId}/visits?${RANGE}&reached_goal=${thanks.id}`,
    );
    expect(visits.json<{ total: number }>().total).toBe(1);
  });

  it('answers 404 goal_not_found for a goal id of no goal of the project', async () => {
    const overview = await call(
      'GET',
      `/v1/projects/${projectId}/overview?${RANGE}&goal=${MISSING_ID}`,
    );
    const patch = await call('PATCH', `${goalsUrl()}/${MISSING_ID}`, { payload: { name: 'X' } });

    expect(overview.statusCode).toBe(404);
    expect(overview.json()).toMatchObject({ error: 'goal_not_found' });
    expect(patch.statusCode).toBe(404);
  });

  it('keeps the old conversion_event as goal 1 for the deployed dashboard', async () => {
    const changed = await call('PATCH', `/v1/projects/${projectId}`, {
      payload: { conversion_event: 'purchase' },
    });

    expect(changed.json()).toMatchObject({ conversion_event: 'purchase' });
    expect((await listGoals())[0]).toMatchObject({ name: 'purchase', event: 'purchase' });
    const me = await call('GET', '/v1/me');
    expect(
      me
        .json<{ projects: { id: string; conversion_event: string | null }[] }>()
        .projects.find(({ id }) => id === projectId),
    ).toMatchObject({ conversion_event: 'purchase' });
  });

  it('renames and deletes goals, the next becoming the default', async () => {
    const [first, second] = await listGoals();

    const renamed = await call('PATCH', `${goalsUrl()}/${second?.id ?? ''}`, {
      payload: { name: 'Order done' },
    });
    const deleted = await call('DELETE', `${goalsUrl()}/${first?.id ?? ''}`);

    expect(renamed.json()).toMatchObject({ name: 'Order done', path: '/thanks/*' });
    expect(deleted.statusCode).toBe(204);
    expect((await listGoals()).map(({ name }) => name)).toEqual(['Order done']);
    expect(await overviewConversions()).toMatchObject({ current: 1 });
  });

  it('stops at ten goals', async () => {
    for (let index = (await listGoals()).length; index < 10; index += 1) {
      await call('POST', goalsUrl(), { payload: { name: `Goal ${String(index)}`, event: 'x' } });
    }

    const eleventh = await call('POST', goalsUrl(), { payload: { name: 'One more', event: 'x' } });

    expect(eleventh.statusCode).toBe(409);
    expect(eleventh.json()).toMatchObject({ error: 'goal_limit_reached' });
  });

  it('refuses a body with both an event and a path', async () => {
    const response = await call('POST', goalsUrl(), {
      payload: { name: 'Both', event: 'x', path: '/x' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('answers 404 to an admin without access, for reading and for writing', async () => {
    const list = await call('GET', goalsUrl(), { cookie: STRANGER_COOKIE });
    const create = await call('POST', goalsUrl(), {
      cookie: STRANGER_COOKIE,
      payload: { name: 'Mine', event: 'x' },
    });

    expect(list.statusCode).toBe(404);
    expect(create.statusCode).toBe(404);
  });
});
