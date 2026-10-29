import type postgres from 'postgres';
import type { PropertyMap, TrackedEvent } from '../../src/domain/entities/tracked-event.entity';
import type { QueryScope } from '../../src/domain/queries/query-scope';
import { NO_REPORT_FILTERS } from '../../src/domain/queries/report-filters';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzlePropertySummaryQuery } from '../../src/infra/queries/drizzle-property-summary.query';
import { DrizzleEventRepository } from '../../src/infra/repositories/drizzle-event.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const BLOG_ID = 'c3d4e5f6-a7b8-4c9d-8e0f-1a2b3c4d5e6f';
const OTHER_ID = 'd4e5f6a7-b8c9-4d0e-8f1a-2b3c4d5e6f7a';
const READ = 'article_read_100';
const IN_RANGE = '2026-10-05T12:00:00.000Z';

let sequence = 0;

function read(
  sessionNumber: number,
  properties: PropertyMap,
  overrides: Partial<TrackedEvent> = {},
): TrackedEvent {
  sequence += 1;
  return {
    id: `77777777-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    projectId: BLOG_ID,
    name: READ,
    occurredAt: new Date(IN_RANGE),
    receivedAt: new Date(IN_RANGE),
    sessionId: `bbbbbbbb-0000-4000-8000-${String(sessionNumber).padStart(12, '0')}`,
    userId: null,
    path: '/blog',
    attribution: null,
    channel: null,
    deviceType: sessionNumber % 2 === 0 ? 'desktop' : 'mobile',
    browser: 'chrome',
    os: 'android',
    country: 'BR',
    region: null,
    regionName: null,
    city: null,
    properties,
    ...overrides,
  };
}

const SEEDED: readonly TrackedEvent[] = [
  read(1, { seconds: 10, post: 'angular' }),
  read(2, { seconds: 20, post: 'angular' }),
  read(3, { seconds: 30, post: 'angular' }),
  read(4, { seconds: 40, post: 'react' }),
  read(5, { seconds: 50, post: 'react' }),
  read(6, { seconds: 60 }),
  read(7, { seconds: 'seventy', post: 'react' }),
  read(8, { post: 'angular' }),
  read(9, { seconds: 90, post: 'angular' }, { occurredAt: new Date('2026-10-03T12:00:00.000Z') }),
  read(10, { seconds: 100, post: 'angular' }, { projectId: OTHER_ID }),
  read(11, { seconds: 110, post: 'vue' }, { name: 'article_read_50' }),
  ...Array.from({ length: 11 }, (_, index) =>
    read(20 + index, { seconds: 5, post: `post_${String(index).padStart(2, '0')}` }),
  ),
];

const SCOPE: QueryScope = {
  projectId: BLOG_ID,
  timeZone: 'UTC',
  conversionEvent: null,
  range: { from: '2026-10-04', to: '2026-10-05' },
  filters: NO_REPORT_FILTERS,
};

describe('DrizzlePropertySummaryQuery against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let query: DrizzlePropertySummaryQuery;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    query = new DrizzlePropertySummaryQuery(createDrizzleDatabase(app));
    await emptyIngestionTables(owner);
    await owner`
      INSERT INTO projects (id, name) VALUES (${BLOG_ID}, 'Blog'), (${OTHER_ID}, 'Other')
    `;
    await new DrizzleEventRepository(createDrizzleDatabase(app)).insertMany(SEEDED);
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it('sums up only the events of the range whose property is a number', async () => {
    const counts = await query.summarize(SCOPE, { name: READ, key: 'seconds', by: null }, 10);

    expect(counts.overall.events).toBe(17);
    expect(counts.overall.median).toBe(5);
    expect(counts.groups).toEqual([]);
    expect(counts.groupedEvents).toBe(0);
  });

  it('splits the numbers by another property, the most carried values first', async () => {
    const counts = await query.summarize(SCOPE, { name: READ, key: 'seconds', by: 'post' }, 2);

    expect(counts.groups).toEqual([
      { value: 'angular', events: 3, median: 20, p25: 15, p75: 25 },
      { value: 'react', events: 2, median: 45, p25: 42.5, p75: 47.5 },
    ]);
    expect(counts.groupedEvents).toBe(16);
  });

  it('answers no figures for a property that is never a number, or an event never sent', async () => {
    expect(
      (await query.summarize(SCOPE, { name: READ, key: 'post', by: null }, 10)).overall,
    ).toEqual({ events: 0, median: null, p25: null, p75: null });
    expect(
      (await query.summarize(SCOPE, { name: 'never_sent', key: 'seconds', by: 'post' }, 10)).groups,
    ).toEqual([]);
  });

  it('counts only the events of the visits the filters select', async () => {
    const counts = await query.summarize(
      { ...SCOPE, filters: { ...NO_REPORT_FILTERS, deviceType: 'desktop' } },
      { name: READ, key: 'seconds', by: 'post' },
      10,
    );

    expect(counts.overall.events).toBe(9);
    expect(counts.groups.find((group) => group.value === 'react')).toEqual({
      value: 'react',
      events: 1,
      median: 40,
      p25: 40,
      p75: 40,
    });
  });
});
