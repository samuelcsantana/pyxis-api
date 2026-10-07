import type postgres from 'postgres';
import type { TrackedEvent } from '../../src/domain/entities/tracked-event.entity';
import type { QueryScope } from '../../src/domain/queries/query-scope';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleDevicesQuery } from '../../src/infra/queries/drizzle-devices.query';
import { DrizzleEventRepository } from '../../src/infra/repositories/drizzle-event.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const SHOP_ID = 'a7b8c9d0-e1f2-4a3b-8c4d-5e6f7a8b9c0d';
const BLOG_ID = 'b8c9d0e1-f2a3-4b4c-9d5e-6f7a8b9c0d1e';

let sequence = 0;

function event(
  sessionNumber: number,
  name: string,
  device: Pick<TrackedEvent, 'deviceType' | 'browser' | 'os' | 'country'>,
  overrides: Partial<TrackedEvent> = {},
): TrackedEvent {
  sequence += 1;
  return {
    id: `33333333-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    projectId: SHOP_ID,
    name,
    occurredAt: new Date('2026-10-05T12:00:00.000Z'),
    receivedAt: new Date('2026-10-05T12:00:00.000Z'),
    sessionId: `44444444-0000-4000-8000-${String(sessionNumber).padStart(12, '0')}`,
    userId: null,
    path: '/',
    attribution: null,
    channel: null,
    properties: {},
    ...device,
    ...overrides,
  };
}

const IPHONE = { deviceType: 'mobile', browser: 'safari', os: 'ios', country: 'BR' } as const;
const LAPTOP = { deviceType: 'desktop', browser: 'chrome', os: 'macos', country: null } as const;

const SEEDED: readonly TrackedEvent[] = [
  event(1, 'page_view', IPHONE),
  event(1, 'page_view', IPHONE),
  event(1, 'signup_completed', IPHONE),
  event(1, 'signup_completed', IPHONE),
  event(2, 'page_view', IPHONE),
  event(3, 'page_view', LAPTOP),
  event(3, 'signup_completed', LAPTOP, { occurredAt: new Date('2026-09-01T12:00:00.000Z') }),
  event(4, 'page_view', LAPTOP, { projectId: BLOG_ID }),
];

const SCOPE: QueryScope = {
  projectId: SHOP_ID,
  timeZone: 'UTC',
  conversionEvent: 'signup_completed',
  range: { from: '2026-10-01', to: '2026-10-05' },
};

describe('DrizzleDevicesQuery against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let query: DrizzleDevicesQuery;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    const db = createDrizzleDatabase(app);
    query = new DrizzleDevicesQuery(db);
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

  it('counts visits, conversion events and converting visits per device type', async () => {
    const rows = await query.breakdown(SCOPE, 'deviceType');

    expect([...rows].sort((left, right) => right.visits - left.visits)).toEqual([
      { value: 'mobile', visits: 2, conversions: 2, convertingVisits: 1 },
      { value: 'desktop', visits: 1, conversions: 0, convertingVisits: 0 },
    ]);
  });

  it.each([
    ['browser', 'safari'],
    ['os', 'ios'],
    ['country', 'BR'],
  ] as const)('groups by %s too', async (dimension, mobileValue) => {
    const rows = await query.breakdown(SCOPE, dimension);

    expect(rows).toContainEqual({
      value: mobileValue,
      visits: 2,
      conversions: 2,
      convertingVisits: 1,
    });
  });

  it('keeps a missing country as null for the use case to fold', async () => {
    expect(await query.breakdown(SCOPE, 'country')).toContainEqual({
      value: null,
      visits: 1,
      conversions: 0,
      convertingVisits: 0,
    });
  });

  it('never counts another project', async () => {
    expect(await query.breakdown({ ...SCOPE, projectId: BLOG_ID }, 'deviceType')).toEqual([
      { value: 'desktop', visits: 1, conversions: 0, convertingVisits: 0 },
    ]);
  });
});
