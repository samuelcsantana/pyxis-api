import type postgres from 'postgres';
import type { TrackedEvent } from '../../src/domain/entities/tracked-event.entity';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleProjectActivityQuery } from '../../src/infra/queries/drizzle-project-activity.query';
import { DrizzleEventRepository } from '../../src/infra/repositories/drizzle-event.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const SHOP_ID = 'a1a1a1a1-0000-4000-8000-000000000001';
const BLOG_ID = 'a1a1a1a1-0000-4000-8000-000000000002';
const QUIET_ID = 'a1a1a1a1-0000-4000-8000-000000000003';

let sequence = 0;

function event(projectId: string, occurredAt: string): TrackedEvent {
  sequence += 1;
  return {
    id: `b2b2b2b2-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    projectId,
    name: 'page_view',
    occurredAt: new Date(occurredAt),
    receivedAt: new Date(occurredAt),
    sessionId: 'c3c3c3c3-0000-4000-8000-000000000001',
    userId: null,
    path: '/',
    attribution: null,
    channel: null,
    deviceType: 'desktop',
    browser: 'chrome',
    os: 'macos',
    country: 'BR',
    properties: {},
  };
}

describe('DrizzleProjectActivityQuery against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let query: DrizzleProjectActivityQuery;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    const db = createDrizzleDatabase(app);
    query = new DrizzleProjectActivityQuery(db);
    await emptyIngestionTables(owner);
    await owner`
      INSERT INTO projects (id, name)
      VALUES (${SHOP_ID}, 'Shop'), (${BLOG_ID}, 'Blog'), (${QUIET_ID}, 'Quiet')
    `;
    await new DrizzleEventRepository(db).insertMany([
      event(SHOP_ID, '2026-10-05T09:30:00.250Z'),
      event(SHOP_ID, '2026-10-01T12:00:00.000Z'),
      event(SHOP_ID, '2026-10-03T08:00:00.000Z'),
      event(BLOG_ID, '2026-09-20T10:00:00.000Z'),
    ]);
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it('gives the first and the latest event of each project asked, and nulls before any', async () => {
    const activity = await query.activityOf([SHOP_ID, QUIET_ID]);

    expect(activity).toEqual(
      new Map([
        [
          SHOP_ID,
          {
            firstEventAt: new Date('2026-10-01T12:00:00.000Z'),
            lastEventAt: new Date('2026-10-05T09:30:00.250Z'),
          },
        ],
        [QUIET_ID, { firstEventAt: null, lastEventAt: null }],
      ]),
    );
  });

  it('answers nothing for an admin without projects', async () => {
    expect(await query.activityOf([])).toEqual(new Map());
  });
});
