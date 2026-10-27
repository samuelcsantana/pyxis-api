import type postgres from 'postgres';
import type { TrackedEvent } from '../../src/domain/entities/tracked-event.entity';
import type { ArrivalsAsk } from '../../src/domain/queries/arrivals';
import { NO_REPORT_FILTERS } from '../../src/domain/queries/report-filters';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleArrivalsQuery } from '../../src/infra/queries/drizzle-arrivals.query';
import { DrizzleEventRepository } from '../../src/infra/repositories/drizzle-event.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const SHOP_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const BLOG_ID = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';

let sequence = 0;

function session(visit: string): string {
  return `77777777-0000-4000-8000-${visit.padStart(12, '0')}`;
}

function event(
  visit: string,
  occurredAt: string,
  receivedAt: string,
  overrides: Partial<TrackedEvent> = {},
): TrackedEvent {
  sequence += 1;
  return {
    id: `88888888-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    projectId: SHOP_ID,
    name: 'page_view',
    occurredAt: new Date(occurredAt),
    receivedAt: new Date(receivedAt),
    sessionId: session(visit),
    userId: null,
    path: '/',
    attribution: null,
    channel: null,
    properties: {},
    deviceType: 'desktop',
    browser: 'chrome',
    os: 'macos',
    country: 'BR',
    region: null,
    regionName: null,
    ...overrides,
  };
}

function request(method: string, status: number) {
  return { name: 'api_request', properties: { method, route: '/orders', status } };
}

const SEEDED: readonly TrackedEvent[] = [
  event('1', '2026-10-23T16:30:00.000Z', '2026-10-23T16:30:00.500Z', { channel: 'direct' }),
  event('1', '2026-10-23T16:31:00.000Z', '2026-10-23T16:31:00.000Z'),
  event('1', '2026-10-23T16:32:00.000Z', '2026-10-23T16:32:00.000Z', {
    name: 'signup_completed',
  }),
  event('1', '2026-10-23T16:33:00.000Z', '2026-10-23T16:33:00.000Z', request('POST', 500)),
  event('1', '2026-10-23T16:34:00.000Z', '2026-10-23T16:34:00.000Z', request('GET', 404)),
  event('1', '2026-10-23T16:35:00.000Z', '2026-10-23T16:35:00.000Z', request('POST', 201)),
  event('2', '2026-10-23T02:50:00.000Z', '2026-10-23T16:40:00.000Z', { channel: 'organic' }),
  event('3', '2026-10-23T15:00:00.000Z', '2026-10-23T15:00:00.000Z', { channel: 'direct' }),
  event('4', '2026-10-20T12:00:00.000Z', '2026-10-23T17:02:00.000Z'),
  event('4', '2026-10-23T17:03:00.000Z', '2026-10-23T17:03:00.000Z', { name: 'cta_clicked' }),
  event('5', '2026-10-23T17:04:00.000Z', '2026-10-23T17:04:00.000Z', { name: 'identify' }),
  event('6', '2026-10-23T16:50:00.000Z', '2026-10-23T16:50:00.000Z', {
    projectId: BLOG_ID,
    channel: 'direct',
  }),
  event('6', '2026-10-23T17:03:00.000Z', '2026-10-23T17:03:00.000Z', { projectId: BLOG_ID }),
];

const TODAY: ArrivalsAsk = {
  scope: {
    projectId: SHOP_ID,
    timeZone: 'America/Sao_Paulo',
    conversionEvent: 'signup_completed',
    range: { from: '2026-10-23', to: '2026-10-23' },
    filters: NO_REPORT_FILTERS,
  },
  since: new Date('2026-10-23T16:00:00.000Z'),
  activeSince: new Date('2026-10-23T17:00:00.000Z'),
  limit: 101,
};

const SEVEN_DAYS: ArrivalsAsk = {
  ...TODAY,
  scope: { ...TODAY.scope, range: { from: '2026-10-17', to: '2026-10-23' } },
};

describe('DrizzleArrivalsQuery against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let query: DrizzleArrivalsQuery;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    const db = createDrizzleDatabase(app);
    query = new DrizzleArrivalsQuery(db);
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

  it('lists, newest first, what of each kind arrived since the moment and happened today', async () => {
    expect(await query.arrivals(TODAY)).toEqual({
      visits: [new Date('2026-10-23T16:30:00.500Z')],
      conversions: [new Date('2026-10-23T16:32:00.000Z')],
      namedEvents: [new Date('2026-10-23T17:03:00.000Z'), new Date('2026-10-23T16:32:00.000Z')],
      failedRequests: [new Date('2026-10-23T16:34:00.000Z'), new Date('2026-10-23T16:33:00.000Z')],
      activeVisits: 2,
    });
  });

  it('counts a visit that happened yesterday and arrived today in a range that holds yesterday', async () => {
    const arrived = await query.arrivals(SEVEN_DAYS);

    expect(arrived.visits).toEqual([
      new Date('2026-10-23T16:40:00.000Z'),
      new Date('2026-10-23T16:30:00.500Z'),
    ]);
  });

  it('asks for no conversions when the project has no conversion event', async () => {
    const arrived = await query.arrivals({
      ...TODAY,
      scope: { ...TODAY.scope, conversionEvent: null },
    });

    expect(arrived.conversions).toBeNull();
  });

  it('stops at the limit it is given', async () => {
    const arrived = await query.arrivals({ ...SEVEN_DAYS, limit: 1 });

    expect(arrived.visits).toEqual([new Date('2026-10-23T16:40:00.000Z')]);
    expect(arrived.failedRequests).toEqual([new Date('2026-10-23T16:34:00.000Z')]);
  });

  it('uses the index on the reception time for the arrivals of a project', async () => {
    const plan = await owner.begin(async (transaction) => {
      await transaction`SET LOCAL enable_seqscan = off`;
      const rows = await transaction<{ 'QUERY PLAN': string }[]>`
        EXPLAIN SELECT received_at FROM events
        WHERE project_id = ${SHOP_ID} AND received_at > '2026-10-23T16:00:00Z'
        ORDER BY received_at DESC LIMIT 101`;
      return rows.map((row) => row['QUERY PLAN']).join('\n');
    });

    expect(plan).toContain('events_project_received_at_idx');
  });
});
