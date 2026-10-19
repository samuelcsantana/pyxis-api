import type postgres from 'postgres';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleAdminUserRepository } from '../../src/infra/repositories/drizzle-admin-user.repository';
import { DrizzleReviewerCodeRepository } from '../../src/infra/repositories/drizzle-reviewer-code.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const NOW = new Date('2026-10-20T12:00:00.000Z');
const LATER = new Date('2027-10-20T12:00:00.000Z');
const MAX_FAILURES = 3;

describe('DrizzleReviewerCodeRepository against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let admins: DrizzleAdminUserRepository;
  let codes: DrizzleReviewerCodeRepository;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    const db = createDrizzleDatabase(app);
    admins = new DrizzleAdminUserRepository(db);
    codes = new DrizzleReviewerCodeRepository(db);
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  async function reviewer(): Promise<string> {
    return (await admins.findOrCreateByEmail('reviewer@example.com')).id;
  }

  it('opens a code, replacing the one before and its failed attempts', async () => {
    const adminUserId = await reviewer();
    await codes.open({ adminUserId, codeHash: 'a'.repeat(64), createdAt: NOW, expiresAt: LATER });
    await codes.reserveAttempt(adminUserId, NOW, MAX_FAILURES);

    const reopened = await codes.open({
      adminUserId,
      codeHash: 'b'.repeat(64),
      createdAt: LATER,
      expiresAt: new Date('2028-10-20T12:00:00.000Z'),
    });

    expect(reopened).toEqual({
      adminUserId,
      codeHash: 'b'.repeat(64),
      failedAttempts: 0,
      createdAt: LATER,
      expiresAt: new Date('2028-10-20T12:00:00.000Z'),
    });
    expect(await codes.findLive(adminUserId, NOW)).toEqual(reopened);
  });

  it('finds a code only before it expires', async () => {
    const adminUserId = await reviewer();
    await codes.open({ adminUserId, codeHash: 'a'.repeat(64), createdAt: NOW, expiresAt: LATER });

    expect(await codes.findLive(adminUserId, NOW)).toMatchObject({ adminUserId });
    expect(await codes.findLive(adminUserId, LATER)).toBeNull();
    expect(await codes.reserveAttempt(adminUserId, LATER, MAX_FAILURES)).toBeNull();
  });

  it('reserves attempts up to the cap and gives back the ones that were right', async () => {
    const adminUserId = await reviewer();
    await codes.open({ adminUserId, codeHash: 'a'.repeat(64), createdAt: NOW, expiresAt: LATER });

    const reserved: (number | undefined)[] = [];
    for (let attempt = 0; attempt < MAX_FAILURES; attempt += 1) {
      reserved.push((await codes.reserveAttempt(adminUserId, NOW, MAX_FAILURES))?.failedAttempts);
    }
    const overTheCap = await codes.reserveAttempt(adminUserId, NOW, MAX_FAILURES);
    await codes.releaseAttempt(adminUserId);

    expect(reserved).toEqual([1, 2, 3]);
    expect(overTheCap).toBeNull();
    expect((await codes.findLive(adminUserId, NOW))?.failedAttempts).toBe(2);
  });

  it('never counts below zero when an attempt is given back', async () => {
    const adminUserId = await reviewer();
    await codes.open({ adminUserId, codeHash: 'a'.repeat(64), createdAt: NOW, expiresAt: LATER });

    await codes.releaseAttempt(adminUserId);

    expect((await codes.findLive(adminUserId, NOW))?.failedAttempts).toBe(0);
  });

  it('closes a code once, and the code goes with its admin', async () => {
    const adminUserId = await reviewer();
    await codes.open({ adminUserId, codeHash: 'a'.repeat(64), createdAt: NOW, expiresAt: LATER });

    expect(await codes.close(adminUserId)).toBe(true);
    expect(await codes.close(adminUserId)).toBe(false);

    await codes.open({ adminUserId, codeHash: 'a'.repeat(64), createdAt: NOW, expiresAt: LATER });
    await owner`DELETE FROM admin_users WHERE id = ${adminUserId}`;

    expect(await codes.findLive(adminUserId, NOW)).toBeNull();
  });
});
