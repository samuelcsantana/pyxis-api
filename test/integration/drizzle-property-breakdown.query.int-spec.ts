import type postgres from 'postgres';
import type { PropertyMap, TrackedEvent } from '../../src/domain/entities/tracked-event.entity';
import type { QueryScope } from '../../src/domain/queries/query-scope';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzlePropertyBreakdownQuery } from '../../src/infra/queries/drizzle-property-breakdown.query';
import { DrizzleEventRepository } from '../../src/infra/repositories/drizzle-event.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const SHOP_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const BLOG_ID = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
const RESULT = 'calculator_result_shown';

let sequence = 0;

function event(
  sessionNumber: number,
  occurredAt: string,
  name: string,
  properties: PropertyMap,
  overrides: Partial<TrackedEvent> = {},
): TrackedEvent {
  sequence += 1;
  return {
    id: `99999999-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    projectId: SHOP_ID,
    name,
    occurredAt: new Date(occurredAt),
    receivedAt: new Date(occurredAt),
    sessionId: `aaaaaaaa-0000-4000-8000-${String(sessionNumber).padStart(12, '0')}`,
    userId: null,
    path: '/calculator',
    attribution: null,
    channel: null,
    deviceType: 'mobile',
    browser: 'safari',
    os: 'ios',
    country: 'BR',
    properties,
    ...overrides,
  };
}

const IN_RANGE = '2026-10-05T12:00:00.000Z';

const SEEDED: readonly TrackedEvent[] = [
  event(1, IN_RANGE, RESULT, { calculator: 'ifood', used_plan_preset: true }),
  event(2, IN_RANGE, RESULT, { calculator: 'ifood', used_plan_preset: false }),
  event(2, IN_RANGE, RESULT, { calculator: 'ifood', used_plan_preset: true }),
  event(3, IN_RANGE, RESULT, { calculator: '99food', used_plan_preset: false }),
  event(4, IN_RANGE, RESULT, { calculator: '99food' }),
  event(5, IN_RANGE, RESULT, {}),
  event(6, '2026-10-03T12:00:00.000Z', RESULT, { calculator: 'ifood' }),
  event(7, IN_RANGE, RESULT, { calculator: 'ifood' }, { projectId: BLOG_ID }),
  event(8, IN_RANGE, 'cta_clicked', { cta: 'start_trial' }),
  event(9, IN_RANGE, 'api_request', { method: 'POST', route: '/v1/plans', status: 201 }),
  ...Array.from({ length: 12 }, (_, index) =>
    event(10 + index, IN_RANGE, 'plan_picked', { plan: `plan_${String(index).padStart(2, '0')}` }),
  ),
  event(30, IN_RANGE, 'plan_picked', { plan: 'plan_05' }),
];

const SCOPE: QueryScope = {
  projectId: SHOP_ID,
  timeZone: 'UTC',
  conversionEvent: null,
  range: { from: '2026-10-04', to: '2026-10-05' },
};

describe('DrizzlePropertyBreakdownQuery against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let query: DrizzlePropertyBreakdownQuery;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    query = new DrizzlePropertyBreakdownQuery(createDrizzleDatabase(app));
    await emptyIngestionTables(owner);
    await owner`
      INSERT INTO projects (id, name) VALUES (${SHOP_ID}, 'Shop'), (${BLOG_ID}, 'Blog')
    `;
    await new DrizzleEventRepository(createDrizzleDatabase(app)).insertMany(SEEDED);
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it('counts each value of each key of one event in the range, with its visits', async () => {
    const counts = await query.counts(SCOPE, RESULT, 10);

    expect(counts.events).toBe(6);
    expect(
      counts.values.toSorted(
        (left, right) => left.key.localeCompare(right.key) || right.count - left.count,
      ),
    ).toEqual([
      { key: 'calculator', value: 'ifood', count: 3, visits: 2, keyEvents: 5 },
      { key: 'calculator', value: '99food', count: 2, visits: 2, keyEvents: 5 },
      { key: 'used_plan_preset', value: 'false', count: 2, visits: 2, keyEvents: 4 },
      { key: 'used_plan_preset', value: 'true', count: 2, visits: 2, keyEvents: 4 },
    ]);
  });

  it('keeps the most counted values of a key, and counts every event that carries it', async () => {
    const counts = await query.counts(SCOPE, 'plan_picked', 10);

    expect(counts.events).toBe(13);
    expect(counts.values).toHaveLength(10);
    expect(counts.values.every((value) => value.keyEvents === 13)).toBe(true);
    expect(counts.values.find((value) => value.value === 'plan_05')).toEqual({
      key: 'plan',
      value: 'plan_05',
      count: 2,
      visits: 2,
      keyEvents: 13,
    });
    expect(counts.values.some((value) => value.value === 'plan_11')).toBe(false);
  });

  it('answers nothing for a reserved event, an unknown one or another project', async () => {
    expect(await query.counts(SCOPE, 'api_request', 10)).toEqual({ events: 0, values: [] });
    expect(await query.counts(SCOPE, 'never_sent', 10)).toEqual({ events: 0, values: [] });
    expect(await query.counts({ ...SCOPE, projectId: BLOG_ID }, 'cta_clicked', 10)).toEqual({
      events: 0,
      values: [],
    });
  });
});
