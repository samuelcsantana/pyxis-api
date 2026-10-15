import type postgres from 'postgres';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleProjectPeopleRepository } from '../../src/infra/repositories/drizzle-project-people.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const OWNER_ID = 'e1e2e3e4-0000-4000-8000-000000000001';
const ACCOUNT_ID = 'e1e2e3e4-0000-4000-8000-000000000011';
const SHOP_ID = 'e1e2e3e4-0000-4000-8000-000000000021';
const BLOG_ID = 'e1e2e3e4-0000-4000-8000-000000000022';
const SLOT = { accountId: ACCOUNT_ID, maxPeople: 3 };

describe('project people against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let people: DrizzleProjectPeopleRepository;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    people = new DrizzleProjectPeopleRepository(createDrizzleDatabase(app));
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
    await owner`INSERT INTO admin_users (id, email) VALUES (${OWNER_ID}, 'owner@example.com')`;
    await owner`
      INSERT INTO accounts (id, owner_admin_id, status) VALUES (${ACCOUNT_ID}, ${OWNER_ID}, 'active')
    `;
    await owner`
      INSERT INTO projects (id, name, account_id)
      VALUES (${SHOP_ID}, 'Shop', ${ACCOUNT_ID}), (${BLOG_ID}, 'Blog', ${ACCOUNT_ID})
    `;
    await owner`
      INSERT INTO admin_project_access (admin_user_id, project_id, created_at)
      VALUES (${OWNER_ID}, ${SHOP_ID}, '2026-10-01T00:00:00Z'),
             (${OWNER_ID}, ${BLOG_ID}, '2026-10-01T00:00:00Z')
    `;
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it('adds a new person, as the application role, and lists the people oldest first', async () => {
    const added = await people.addToAccountProject('guest@example.com', SHOP_ID, SLOT);

    expect(added).toEqual({
      outcome: 'added',
      person: {
        adminUserId: expect.any(String) as string,
        email: 'guest@example.com',
        addedAt: expect.any(Date) as Date,
      },
    });
    expect((await people.peopleOf(SHOP_ID)).map(({ email }) => email)).toEqual([
      'owner@example.com',
      'guest@example.com',
    ]);
    expect(await people.peopleOf(BLOG_ID)).toHaveLength(1);
  });

  it('answers a person already on the project without adding them twice', async () => {
    await people.addToAccountProject('guest@example.com', SHOP_ID, SLOT);

    const again = await people.addToAccountProject('guest@example.com', SHOP_ID, SLOT);

    expect(again.outcome).toBe('already_there');
    expect(await people.peopleOf(SHOP_ID)).toHaveLength(2);
  });

  it('counts distinct people across the projects of the account, the owner included', async () => {
    await people.addToAccountProject('ana@example.com', SHOP_ID, SLOT);
    await people.addToAccountProject('bia@example.com', BLOG_ID, SLOT);

    const refused = await people.addToAccountProject('carla@example.com', SHOP_ID, SLOT);
    const sameAna = await people.addToAccountProject('ana@example.com', BLOG_ID, SLOT);

    expect(refused).toEqual({ outcome: 'people_limit_reached' });
    expect(await owner`SELECT 1 FROM admin_users WHERE email = 'carla@example.com'`).toHaveLength(
      0,
    );
    expect(sameAna.outcome).toBe('added');
  });

  it('lets only one of two simultaneous additions take the last place', async () => {
    await people.addToAccountProject('ana@example.com', SHOP_ID, SLOT);
    const second = createPostgresClient(testAppUrl());
    try {
      const racing = new DrizzleProjectPeopleRepository(createDrizzleDatabase(second));

      const outcomes = await Promise.all([
        people.addToAccountProject('bia@example.com', SHOP_ID, SLOT),
        racing.addToAccountProject('carla@example.com', BLOG_ID, SLOT),
      ]);

      expect(outcomes.map(({ outcome }) => outcome).sort()).toEqual([
        'added',
        'people_limit_reached',
      ]);
    } finally {
      await second.end();
    }
  });

  it('removes a person from one project only, and tells when there was nobody to remove', async () => {
    const added = await people.addToAccountProject('guest@example.com', SHOP_ID, SLOT);
    await people.addToAccountProject('guest@example.com', BLOG_ID, SLOT);
    if (added.outcome !== 'added') {
      throw new Error(`expected an addition, got ${added.outcome}`);
    }

    expect(await people.remove(SHOP_ID, added.person.adminUserId)).toBe(true);
    expect(await people.remove(SHOP_ID, added.person.adminUserId)).toBe(false);
    expect((await people.peopleOf(BLOG_ID)).map(({ email }) => email)).toContain(
      'guest@example.com',
    );
  });
});
