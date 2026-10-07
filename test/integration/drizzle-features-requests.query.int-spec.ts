import type postgres from 'postgres';
import type { PropertyMap, TrackedEvent } from '../../src/domain/entities/tracked-event.entity';
import type { QueryScope } from '../../src/domain/queries/query-scope';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleFeaturesQuery } from '../../src/infra/queries/drizzle-features.query';
import { DrizzleRequestsQuery } from '../../src/infra/queries/drizzle-requests.query';
import { DrizzleEventRepository } from '../../src/infra/repositories/drizzle-event.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const SHOP_ID = 'e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b';
const BLOG_ID = 'f2a3b4c5-d6e7-4f8a-9b0c-1d2e3f4a5b6c';

let sequence = 0;

function event(
  sessionNumber: number,
  occurredAt: string,
  name: string,
  overrides: Partial<TrackedEvent> = {},
): TrackedEvent {
  sequence += 1;
  return {
    id: `77777777-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    projectId: SHOP_ID,
    name,
    occurredAt: new Date(occurredAt),
    receivedAt: new Date(occurredAt),
    sessionId: `88888888-0000-4000-8000-${String(sessionNumber).padStart(12, '0')}`,
    userId: null,
    path: '/',
    attribution: null,
    channel: null,
    deviceType: 'mobile',
    browser: 'safari',
    os: 'ios',
    country: 'BR',
    properties: {},
    ...overrides,
  };
}

function call(
  sessionNumber: number,
  occurredAt: string,
  path: string,
  request: { method: string; route: string; status: number; duration: number; errorCode?: string },
): TrackedEvent {
  const properties: PropertyMap = {
    method: request.method,
    route: request.route,
    status: request.status,
    duration_ms: request.duration,
    ...(request.errorCode === undefined ? {} : { error_code: request.errorCode }),
  };
  return event(sessionNumber, occurredAt, 'api_request', { path, properties });
}

const PLANS = { method: 'POST', route: '/v1/plans' };

const SEEDED: readonly TrackedEvent[] = [
  event(1, '2026-10-04T12:00:00.000Z', 'page_view', { path: '/pricing' }),
  event(1, '2026-10-04T12:01:00.000Z', 'plan_selected', { path: '/pricing' }),
  event(1, '2026-10-05T12:00:00.000Z', 'plan_selected', { path: '/pricing' }),
  event(2, '2026-10-05T13:00:00.000Z', 'page_view', { path: '/' }),
  event(2, '2026-10-05T13:01:00.000Z', 'page_view', { path: '/pricing' }),
  event(2, '2026-10-05T13:02:00.000Z', 'calculator_used', { path: '/' }),
  event(2, '2026-10-05T13:03:00.000Z', 'identify', { userId: 'u1' }),
  call(1, '2026-10-05T12:10:00.000Z', '/pricing', { ...PLANS, status: 201, duration: 40 }),
  call(1, '2026-10-05T12:11:00.000Z', '/pricing', { ...PLANS, status: 201, duration: 60 }),
  call(1, '2026-10-05T12:12:00.000Z', '/checkout', {
    ...PLANS,
    status: 422,
    duration: 100,
    errorCode: 'card_declined',
  }),
  call(2, '2026-10-05T13:10:00.000Z', '/pricing', { ...PLANS, status: 0, duration: 3000 }),
  call(2, '2026-10-05T13:11:00.000Z', '/pricing', {
    method: 'DELETE',
    route: '/v1/plans/:id',
    status: 503,
    duration: 20,
  }),
  call(2, '2026-10-05T13:12:00.000Z', '/pricing', {
    method: 'GET',
    route: '/v1/plans',
    status: 500,
    duration: 10,
  }),
  call(2, '2026-10-05T13:13:00.000Z', '/pricing', {
    method: 'GET',
    route: '/v1/plans',
    status: 200,
    duration: 12,
  }),
  call(1, '2026-10-05T12:20:00.000Z', '/checkout', {
    method: 'GET',
    route: '/v1/plans',
    status: 0,
    duration: 5000,
    errorCode: 'network_error',
  }),
  event(3, '2026-10-05T12:00:00.000Z', 'plan_selected', { projectId: BLOG_ID }),
];

const SCOPE: QueryScope = {
  projectId: SHOP_ID,
  timeZone: 'UTC',
  conversionEvent: null,
  range: { from: '2026-10-04', to: '2026-10-05' },
};

describe('features and requests queries against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let features: DrizzleFeaturesQuery;
  let requests: DrizzleRequestsQuery;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    const db = createDrizzleDatabase(app);
    features = new DrizzleFeaturesQuery(db);
    requests = new DrizzleRequestsQuery(db);
    await emptyIngestionTables(owner);
    await owner`
      INSERT INTO projects (id, name) VALUES (${SHOP_ID}, 'Shop'), (${BLOG_ID}, 'Blog')
    `;
    await new DrizzleEventRepository(db).insertMany(SEEDED);
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  describe('DrizzleFeaturesQuery', () => {
    it('ranks named events, never the reserved ones', async () => {
      expect(await features.totals(SCOPE, 'events', 50)).toEqual([
        { name: 'plan_selected', count: 2, visits: 1 },
        { name: 'calculator_used', count: 1, visits: 1 },
      ]);
    });

    it('ranks screens by their page views', async () => {
      expect(await features.totals(SCOPE, 'screens', 50)).toEqual([
        { name: '/pricing', count: 2, visits: 2 },
        { name: '/', count: 1, visits: 1 },
      ]);
    });

    it('counts the days of the names it is given', async () => {
      const days = await features.days(SCOPE, 'events', ['plan_selected']);

      expect([...days].sort((left, right) => left.date.localeCompare(right.date))).toEqual([
        { name: 'plan_selected', date: '2026-10-04', count: 1 },
        { name: 'plan_selected', date: '2026-10-05', count: 1 },
      ]);
    });

    it('honors the limit and never counts another project', async () => {
      expect(await features.totals(SCOPE, 'events', 1)).toHaveLength(1);
      expect(await features.totals({ ...SCOPE, projectId: BLOG_ID }, 'events', 50)).toEqual([
        { name: 'plan_selected', count: 1, visits: 1 },
      ]);
    });
  });

  describe('DrizzleRequestsQuery', () => {
    const everyScreen = { ...SCOPE, screen: null, kind: 'writes' } as const;

    it('totals the writes per route, failed meaning status 0 or 400 and above, never a GET', async () => {
      expect(await requests.routes(everyScreen, 50)).toEqual([
        { method: 'POST', route: '/v1/plans', total: 4, failed: 2, medianDurationMs: 80 },
        { method: 'DELETE', route: '/v1/plans/:id', total: 1, failed: 1, medianDurationMs: 20 },
      ]);
    });

    it('counts each status of each route', async () => {
      expect(await requests.statuses(everyScreen)).toEqual([
        { method: 'DELETE', route: '/v1/plans/:id', status: 503, count: 1 },
        { method: 'POST', route: '/v1/plans', status: 0, count: 1 },
        { method: 'POST', route: '/v1/plans', status: 201, count: 2 },
        { method: 'POST', route: '/v1/plans', status: 422, count: 1 },
      ]);
    });

    it('names the screens each route was called from, with their failures', async () => {
      expect(await requests.screens(everyScreen)).toContainEqual({
        method: 'POST',
        route: '/v1/plans',
        path: '/checkout',
        failed: 1,
      });
    });

    it('keeps the newest failures of each route, with the error code when there is one', async () => {
      expect(await requests.recentFailures(everyScreen, 5)).toEqual([
        {
          method: 'DELETE',
          route: '/v1/plans/:id',
          occurredAt: new Date('2026-10-05T13:11:00.000Z'),
          status: 503,
          errorCode: null,
          sessionId: '88888888-0000-4000-8000-000000000002',
        },
        {
          method: 'POST',
          route: '/v1/plans',
          occurredAt: new Date('2026-10-05T13:10:00.000Z'),
          status: 0,
          errorCode: null,
          sessionId: '88888888-0000-4000-8000-000000000002',
        },
        {
          method: 'POST',
          route: '/v1/plans',
          occurredAt: new Date('2026-10-05T12:12:00.000Z'),
          status: 422,
          errorCode: 'card_declined',
          sessionId: '88888888-0000-4000-8000-000000000001',
        },
      ]);
      expect(await requests.recentFailures(everyScreen, 1)).toHaveLength(2);
    });

    describe('for the failed reads', () => {
      const failedReads = { ...SCOPE, screen: null, kind: 'reads' } as const;

      it('counts GET calls that failed and nothing else, so total equals failed', async () => {
        expect(await requests.routes(failedReads, 50)).toEqual([
          { method: 'GET', route: '/v1/plans', total: 2, failed: 2, medianDurationMs: 2505 },
        ]);
      });

      it('gives their statuses, screens and latest failures', async () => {
        expect(await requests.statuses(failedReads)).toEqual([
          { method: 'GET', route: '/v1/plans', status: 0, count: 1 },
          { method: 'GET', route: '/v1/plans', status: 500, count: 1 },
        ]);
        expect(await requests.screens(failedReads)).toEqual([
          { method: 'GET', route: '/v1/plans', path: '/checkout', failed: 1 },
          { method: 'GET', route: '/v1/plans', path: '/pricing', failed: 1 },
        ]);
        expect(await requests.recentFailures(failedReads, 5)).toEqual([
          {
            method: 'GET',
            route: '/v1/plans',
            occurredAt: new Date('2026-10-05T13:12:00.000Z'),
            status: 500,
            errorCode: null,
            sessionId: '88888888-0000-4000-8000-000000000002',
          },
          {
            method: 'GET',
            route: '/v1/plans',
            occurredAt: new Date('2026-10-05T12:20:00.000Z'),
            status: 0,
            errorCode: 'network_error',
            sessionId: '88888888-0000-4000-8000-000000000001',
          },
        ]);
      });

      it('narrows to one screen too', async () => {
        expect(await requests.routes({ ...failedReads, screen: '/checkout' }, 50)).toMatchObject([
          { total: 1, failed: 1 },
        ]);
      });
    });

    it('narrows everything to one screen when asked', async () => {
      const checkout = { ...SCOPE, screen: '/checkout', kind: 'writes' } as const;

      expect(await requests.routes(checkout, 50)).toEqual([
        { method: 'POST', route: '/v1/plans', total: 1, failed: 1, medianDurationMs: 100 },
      ]);
      expect(await requests.statuses(checkout)).toHaveLength(1);
      expect(await requests.screens(checkout)).toHaveLength(1);
      expect(await requests.recentFailures(checkout, 5)).toHaveLength(1);
    });
  });
});
