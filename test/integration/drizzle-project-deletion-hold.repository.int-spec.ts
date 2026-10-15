import type postgres from 'postgres';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleProjectDeletionHoldRepository } from '../../src/infra/repositories/drizzle-project-deletion-hold.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const NOW = new Date('2026-12-01T03:00:00.000Z');
const SHOP_ID = 'f5f6f7f8-0000-4000-8000-000000000021';
const BLOG_ID = 'f5f6f7f8-0000-4000-8000-000000000022';
const MISSING_ID = 'f5f6f7f8-0000-4000-8000-0000000000ff';

describe("holding a project's deletion against a real Postgres", () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let holds: DrizzleProjectDeletionHoldRepository;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    holds = new DrizzleProjectDeletionHoldRepository(createDrizzleDatabase(app));
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
    await owner`INSERT INTO projects (id, name) VALUES (${SHOP_ID}, 'Shop'), (${BLOG_ID}, 'Blog')`;
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it('holds only that project, with the moment and the reason, as the application role', async () => {
    expect(await holds.hold(SHOP_ID, 'Court order', NOW)).toEqual({
      projectId: SHOP_ID,
      projectName: 'Shop',
      heldAt: NOW,
      reason: 'Court order',
    });
    expect(await holds.holdOf(BLOG_ID)).toEqual({
      projectId: BLOG_ID,
      projectName: 'Blog',
      heldAt: null,
      reason: null,
    });
  });

  it('releases the hold and answers null for a project that does not exist', async () => {
    await holds.hold(SHOP_ID, 'Court order', NOW);

    expect(await holds.release(SHOP_ID)).toEqual({
      projectId: SHOP_ID,
      projectName: 'Shop',
      heldAt: null,
      reason: null,
    });
    expect(await holds.holdOf(MISSING_ID)).toBeNull();
    expect(await holds.hold(MISSING_ID, 'Court order', NOW)).toBeNull();
    expect(await holds.release(MISSING_ID)).toBeNull();
  });
});
