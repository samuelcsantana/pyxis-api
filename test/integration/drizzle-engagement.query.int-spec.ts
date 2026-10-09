import type postgres from 'postgres';
import type { TrackedEvent } from '../../src/domain/entities/tracked-event.entity';
import type { QueryScope } from '../../src/domain/queries/query-scope';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleEngagementQuery } from '../../src/infra/queries/drizzle-engagement.query';
import { DrizzleEventRepository } from '../../src/infra/repositories/drizzle-event.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const SHOP_ID = 'e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b';
const BLOG_ID = 'f2a3b4c5-d6e7-4f8a-9b0c-1d2e3f4a5b6c';
const START = Date.parse('2026-10-05T12:00:00.000Z');

let sequence = 0;

function event(
  sessionNumber: number,
  secondsAfterStart: number,
  path: string,
  overrides: Partial<TrackedEvent> = {},
): TrackedEvent {
  sequence += 1;
  const at = new Date(START + secondsAfterStart * 1000);
  return {
    id: `77777777-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    projectId: SHOP_ID,
    name: 'page_view',
    occurredAt: at,
    receivedAt: at,
    sessionId: `88888888-0000-4000-8000-${String(sessionNumber).padStart(12, '0')}`,
    userId: null,
    path,
    attribution: null,
    channel: null,
    properties: {},
    deviceType: 'desktop',
    browser: 'chrome',
    os: 'macos',
    country: 'BR',
    ...overrides,
  };
}

const SEEDED: readonly TrackedEvent[] = [
  event(1, 0, '/'),
  event(1, 40, '/pricing'),
  event(1, 50, '/pricing', { name: 'signup_completed' }),
  event(2, 0, '/'),
  event(3, 0, '/blog'),
  event(3, 5, '/blog'),
  event(3, 2000, '/'),
  event(4, 0, '/pricing', { name: 'signup_completed' }),
  event(5, 0, '/', { projectId: BLOG_ID }),
];

const SCOPE: QueryScope = {
  projectId: SHOP_ID,
  timeZone: 'UTC',
  conversionEvent: null,
  range: { from: '2026-10-01', to: '2026-10-05' },
};

describe('DrizzleEngagementQuery against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let query: DrizzleEngagementQuery;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    const db = createDrizzleDatabase(app);
    query = new DrizzleEngagementQuery(db);
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

  it('ranks the pages visits started on, with the visits that saw only that page', async () => {
    expect(await query.entryPages(SCOPE, 10)).toEqual([
      { path: '/', visits: 2, singlePageVisits: 1 },
      { path: '/blog', visits: 1, singlePageVisits: 0 },
    ]);
    expect(await query.entryPages(SCOPE, 1)).toHaveLength(1);
  });

  it('ranks the pages visits ended on, by their last page view', async () => {
    expect(await query.exitPages(SCOPE, 10)).toEqual([
      { path: '/', visits: 2 },
      { path: '/pricing', visits: 1 },
    ]);
  });

  it('counts the visits with a page view, the single-page ones and the median length', async () => {
    expect(await query.totals(SCOPE)).toEqual({
      visits: 3,
      singlePageVisits: 1,
      medianVisitSeconds: 50,
    });
  });

  it('spreads the visits over the length buckets, from the first to the last event', async () => {
    expect(await query.visitLengths(SCOPE)).toEqual([
      { bucket: 0, visits: 1 },
      { bucket: 2, visits: 1 },
      { bucket: 6, visits: 1 },
    ]);
  });

  it('answers no median and nothing else for a range without visits', async () => {
    const empty = { ...SCOPE, range: { from: '2026-09-01', to: '2026-09-02' } };

    expect(await query.totals(empty)).toEqual({
      visits: 0,
      singlePageVisits: 0,
      medianVisitSeconds: null,
    });
    expect(await query.entryPages(empty, 10)).toEqual([]);
    expect(await query.visitLengths(empty)).toEqual([]);
  });
});
