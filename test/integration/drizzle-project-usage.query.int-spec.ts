import type postgres from 'postgres';
import type { TrackedEvent } from '../../src/domain/entities/tracked-event.entity';
import { usageMonth } from '../../src/domain/queries/project-usage';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleProjectUsageQuery } from '../../src/infra/queries/drizzle-project-usage.query';
import { DrizzleEventRepository } from '../../src/infra/repositories/drizzle-event.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const SHOP_ID = 'a9b0c1d2-e3f4-4a5b-8c6d-7e8f9a0b1c2d';
const BLOG_ID = 'b0c1d2e3-f4a5-4b6c-9d7e-8f9a0b1c2d3e';
const QUIET_ID = 'c1d2e3f4-a5b6-4c7d-8e8f-9a0b1c2d3e4f';
const OCTOBER = usageMonth('2026-10');

let sequence = 0;

function event(projectId: string, sessionId: string, receivedAt: string): TrackedEvent {
  sequence += 1;
  const at = new Date(receivedAt);
  return {
    id: `d1d1d1d1-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    projectId,
    name: 'page_view',
    occurredAt: at,
    receivedAt: at,
    sessionId,
    userId: null,
    path: '/',
    attribution: null,
    channel: null,
    deviceType: 'desktop',
    browser: 'chrome',
    os: 'windows',
    country: 'BR',
    region: null,
    regionName: null,
    properties: {},
  };
}

const VISIT_A = 'd2d2d2d2-0000-4000-8000-00000000000a';
const VISIT_B = 'd2d2d2d2-0000-4000-8000-00000000000b';
const VISIT_C = 'd2d2d2d2-0000-4000-8000-00000000000c';

describe('DrizzleProjectUsageQuery against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let usage: DrizzleProjectUsageQuery;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    usage = new DrizzleProjectUsageQuery(createDrizzleDatabase(app));
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
    await owner`
      INSERT INTO projects (id, name)
      VALUES (${SHOP_ID}, 'Shop'), (${BLOG_ID}, 'Blog'), (${QUIET_ID}, 'Quiet')
    `;
    await new DrizzleEventRepository(createDrizzleDatabase(app)).insertMany([
      event(SHOP_ID, VISIT_A, '2026-10-01T00:00:00.000Z'),
      event(SHOP_ID, VISIT_A, '2026-10-15T12:00:00.000Z'),
      event(SHOP_ID, VISIT_B, '2026-10-31T23:59:59.999Z'),
      event(SHOP_ID, VISIT_C, '2026-09-30T23:59:59.999Z'),
      event(SHOP_ID, VISIT_C, '2026-11-01T00:00:00.000Z'),
      event(BLOG_ID, VISIT_C, '2026-10-20T08:00:00.000Z'),
    ]);
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it('counts the events and distinct visits received within the month, per project', async () => {
    expect(await usage.usageBetween(OCTOBER.from, OCTOBER.to)).toEqual([
      { projectId: SHOP_ID, name: 'Shop', events: 3, visits: 2 },
      { projectId: BLOG_ID, name: 'Blog', events: 1, visits: 1 },
      { projectId: QUIET_ID, name: 'Quiet', events: 0, visits: 0 },
    ]);
  });

  it('lists every project with zero for a month without events', async () => {
    const august = usageMonth('2026-08');

    expect(await usage.usageBetween(august.from, august.to)).toEqual([
      { projectId: BLOG_ID, name: 'Blog', events: 0, visits: 0 },
      { projectId: QUIET_ID, name: 'Quiet', events: 0, visits: 0 },
      { projectId: SHOP_ID, name: 'Shop', events: 0, visits: 0 },
    ]);
  });
});
