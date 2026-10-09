import type postgres from 'postgres';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleAdminUserRepository } from '../../src/infra/repositories/drizzle-admin-user.repository';
import { DrizzleEmailPreferencesRepository } from '../../src/infra/repositories/drizzle-email-preferences.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const SHOP_ID = 'a3f1c2d4-5b6e-4f70-8192-a3b4c5d6e7f8';
const BLOG_ID = 'b4e2d3c5-6c7f-4081-9203-b4c5d6e7f809';

describe('DrizzleEmailPreferencesRepository against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let admins: DrizzleAdminUserRepository;
  let preferences: DrizzleEmailPreferencesRepository;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    const db = createDrizzleDatabase(app);
    admins = new DrizzleAdminUserRepository(db);
    preferences = new DrizzleEmailPreferencesRepository(db);
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
    await owner`
      INSERT INTO projects (id, name) VALUES (${SHOP_ID}, 'Shop'), (${BLOG_ID}, 'Blog')
    `;
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it('turns the weekly digest on for every new access', async () => {
    const ana = await admins.grantAccess('ana@example.com', SHOP_ID);

    expect(await preferences.preferencesOf(ana.id, SHOP_ID)).toEqual({ weeklyDigest: true });
  });

  it('turns it off for one admin and one project only', async () => {
    const ana = await admins.grantAccess('ana@example.com', SHOP_ID);
    await admins.grantAccess('ana@example.com', BLOG_ID);
    const bruno = await admins.grantAccess('bruno@example.com', SHOP_ID);

    expect(await preferences.save(ana.id, SHOP_ID, { weeklyDigest: false })).toEqual({
      weeklyDigest: false,
    });

    expect(await preferences.preferencesOf(ana.id, SHOP_ID)).toEqual({ weeklyDigest: false });
    expect(await preferences.preferencesOf(ana.id, BLOG_ID)).toEqual({ weeklyDigest: true });
    expect(await preferences.preferencesOf(bruno.id, SHOP_ID)).toEqual({ weeklyDigest: true });
  });

  it('neither reads nor grants a project the admin has no access to', async () => {
    const ana = await admins.grantAccess('ana@example.com', SHOP_ID);

    expect(await preferences.preferencesOf(ana.id, BLOG_ID)).toBeNull();
    expect(await preferences.save(ana.id, BLOG_ID, { weeklyDigest: false })).toBeNull();
    expect((await admins.projectsOf(ana.id)).map((project) => project.id)).toEqual([SHOP_ID]);
  });
});
