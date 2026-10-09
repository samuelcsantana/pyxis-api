import type postgres from 'postgres';
import type { TrackedEvent } from '../../src/domain/entities/tracked-event.entity';
import type { QueryScope } from '../../src/domain/queries/query-scope';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleTimeOfDayQuery } from '../../src/infra/queries/drizzle-time-of-day.query';
import { DrizzleEventRepository } from '../../src/infra/repositories/drizzle-event.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const SHOP_ID = 'c9d0e1f2-a3b4-4c5d-8e6f-7a8b9c0d1e2f';
const BLOG_ID = 'd0e1f2a3-b4c5-4d6e-9f7a-8b9c0d1e2f3a';

let sequence = 0;

function event(
  sessionNumber: number,
  occurredAt: string,
  overrides: Partial<TrackedEvent> = {},
): TrackedEvent {
  sequence += 1;
  return {
    id: `55555555-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    projectId: SHOP_ID,
    name: 'page_view',
    occurredAt: new Date(occurredAt),
    receivedAt: new Date(occurredAt),
    sessionId: `66666666-0000-4000-8000-${String(sessionNumber).padStart(12, '0')}`,
    userId: null,
    path: '/',
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
  event(1, '2026-10-05T12:10:00.000Z'),
  event(1, '2026-10-05T14:30:00.000Z'),
  event(2, '2026-10-05T12:50:00.000Z'),
  event(2, '2026-10-05T12:40:00.000Z', { name: 'signup_completed' }),
  event(3, '2026-10-06T02:30:00.000Z'),
  event(4, '2026-10-05T13:00:00.000Z', { name: 'signup_completed' }),
  event(5, '2026-09-20T12:00:00.000Z'),
  event(6, '2026-10-05T12:00:00.000Z', { projectId: BLOG_ID }),
];

const SCOPE: QueryScope = {
  projectId: SHOP_ID,
  timeZone: 'America/Sao_Paulo',
  conversionEvent: null,
  range: { from: '2026-10-01', to: '2026-10-05' },
};

describe('DrizzleTimeOfDayQuery against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let query: DrizzleTimeOfDayQuery;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    const db = createDrizzleDatabase(app);
    query = new DrizzleTimeOfDayQuery(db);
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

  it('counts each visit once, at the local weekday and hour of its first page view', async () => {
    expect(await query.visitStarts(SCOPE)).toEqual([
      { weekday: 1, hour: 9, visits: 2 },
      { weekday: 1, hour: 23, visits: 1 },
    ]);
  });

  it('counts nothing outside the range or of another project', async () => {
    expect(
      await query.visitStarts({ ...SCOPE, range: { from: '2026-09-01', to: '2026-09-19' } }),
    ).toEqual([]);
  });
});
