import type postgres from 'postgres';
import type { TrackedEvent } from '../../src/domain/entities/tracked-event.entity';
import type { FunnelStep } from '../../src/domain/queries/funnel';
import type { QueryScope } from '../../src/domain/queries/query-scope';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleFunnelQuery } from '../../src/infra/queries/drizzle-funnel.query';
import { DrizzleEventRepository } from '../../src/infra/repositories/drizzle-event.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const SHOP_ID = 'a3b4c5d6-e7f8-4a9b-8c0d-1e2f3a4b5c6d';
const BLOG_ID = 'b4c5d6e7-f8a9-4b0c-9d1e-2f3a4b5c6d7e';

let sequence = 0;

function event(
  sessionNumber: number,
  occurredAt: string,
  name: string,
  overrides: Partial<TrackedEvent> = {},
): TrackedEvent {
  sequence += 1;
  return {
    id: `99999999-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    projectId: SHOP_ID,
    name,
    occurredAt: new Date(occurredAt),
    receivedAt: new Date(occurredAt),
    sessionId: `aaaaaaaa-1111-4000-8000-${String(sessionNumber).padStart(12, '0')}`,
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

const page = (sessionNumber: number, occurredAt: string, path: string) =>
  event(sessionNumber, occurredAt, 'page_view', { path });

const SEEDED: readonly TrackedEvent[] = [
  page(1, '2026-10-04T12:00:00.000Z', '/calculadora-mei'),
  event(1, '2026-10-04T12:05:00.000Z', 'calculator_used'),
  event(1, '2026-10-04T12:10:00.000Z', 'identify', { userId: 'ana' }),
  event(2, '2026-10-05T09:00:00.000Z', 'signup_completed', { userId: 'ana' }),
  event(3, '2026-10-05T10:00:00.000Z', 'calculator_used'),
  page(3, '2026-10-05T10:05:00.000Z', '/calculadora-mei'),
  page(4, '2026-10-05T11:00:00.000Z', '/50%_off'),
  page(5, '2026-10-05T11:00:00.000Z', '/50xxoff'),
  event(6, '2026-10-05T12:00:00.000Z', 'page_view', {
    path: '/calculadora-mei',
    projectId: BLOG_ID,
  }),
];

const SCOPE: QueryScope = {
  projectId: SHOP_ID,
  timeZone: 'UTC',
  conversionEvent: 'signup_completed',
  range: { from: '2026-10-04', to: '2026-10-05' },
};

const CALCULATOR: readonly FunnelStep[] = [
  { type: 'page', path: '/calculadora-*' },
  { type: 'event', name: 'calculator_used' },
  { type: 'event', name: 'signup_completed' },
];

describe('DrizzleFunnelQuery against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let query: DrizzleFunnelQuery;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    const db = createDrizzleDatabase(app);
    query = new DrizzleFunnelQuery(db);
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

  it('counts each step of a visit only after the previous one, never out of order', async () => {
    expect(await query.count(SCOPE, 'visit', CALCULATOR)).toEqual([2, 1, 0]);
  });

  it('gives a person the anonymous steps of the visit they identified in', async () => {
    expect(await query.count(SCOPE, 'user', CALCULATOR)).toEqual([1, 1, 1]);
  });

  it('takes a percent sign and an underscore in a path literally', async () => {
    const steps: readonly FunnelStep[] = [
      { type: 'page', path: '/50%_off' },
      { type: 'page', path: '/50%_off' },
    ];

    expect(await query.count(SCOPE, 'visit', steps)).toEqual([1, 1]);
  });

  it('never counts another project', async () => {
    expect(
      await query.count({ ...SCOPE, projectId: BLOG_ID }, 'visit', CALCULATOR.slice(0, 2)),
    ).toEqual([1, 0]);
  });
});
