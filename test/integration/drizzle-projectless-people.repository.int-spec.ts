import type postgres from 'postgres';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleProjectlessPeopleRepository } from '../../src/infra/repositories/drizzle-projectless-people.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const NOW = new Date('2026-12-01T03:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const READER = 'e1e2e3e4-0000-4000-8000-000000000001';
const OWNER = 'e1e2e3e4-0000-4000-8000-000000000002';
const ALONE = 'e1e2e3e4-0000-4000-8000-000000000003';
const LONG_ALONE = 'e1e2e3e4-0000-4000-8000-000000000004';
const BACK = 'e1e2e3e4-0000-4000-8000-000000000005';
const ACCOUNT_ID = 'e1e2e3e4-0000-4000-8000-000000000011';
const PROJECT_ID = 'e1e2e3e4-0000-4000-8000-000000000021';

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * DAY_MS);
}

describe('people left without a project, against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let people: DrizzleProjectlessPeopleRepository;

  const marks = async () =>
    Object.fromEntries(
      (
        await owner<{ id: string; projectless_since: Date | null }[]>`
          SELECT id, projectless_since FROM admin_users ORDER BY id
        `
      ).map((row) => [row.id, row.projectless_since]),
    );

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    people = new DrizzleProjectlessPeopleRepository(createDrizzleDatabase(app));
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
    await owner`
      INSERT INTO admin_users (id, email, projectless_since)
      VALUES (${READER}, 'reader@example.com', NULL), (${OWNER}, 'owner@example.com', NULL),
             (${ALONE}, 'alone@example.com', NULL),
             (${LONG_ALONE}, 'long-alone@example.com', ${daysAgo(30)}),
             (${BACK}, 'back@example.com', ${daysAgo(40)})
    `;
    await owner`
      INSERT INTO accounts (id, owner_admin_id, status) VALUES (${ACCOUNT_ID}, ${OWNER}, 'active')
    `;
    await owner`INSERT INTO projects (id, name, account_id) VALUES (${PROJECT_ID}, 'Shop', ${ACCOUNT_ID})`;
    await owner`
      INSERT INTO admin_project_access (admin_user_id, project_id)
      VALUES (${READER}, ${PROJECT_ID}), (${BACK}, ${PROJECT_ID})
    `;
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it('clears the mark of a person who has a project again, as the application role', async () => {
    expect(await people.clearReturned()).toBe(1);
    expect((await marks())[BACK]).toBeNull();
  });

  it('marks only the people with no project and no account who carry no mark yet', async () => {
    expect(await people.markProjectless(NOW)).toBe(1);

    const after = await marks();
    expect(after[ALONE]).toEqual(NOW);
    expect(after[LONG_ALONE]).toEqual(daysAgo(30));
    expect(after[READER]).toBeNull();
    expect(after[OWNER]).toBeNull();
  });

  it('deletes the people marked before the threshold who are still alone', async () => {
    expect(await people.deleteProjectlessSince(daysAgo(30))).toBe(1);

    const left = await owner<{ id: string }[]>`SELECT id FROM admin_users ORDER BY id`;
    expect(left.map((row) => row.id)).toEqual([READER, OWNER, ALONE, BACK]);
  });
});
