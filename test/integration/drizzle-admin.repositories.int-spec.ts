import type postgres from 'postgres';
import { sha256Hex } from '../../src/domain/auth/hashing';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleAdminSessionRepository } from '../../src/infra/repositories/drizzle-admin-session.repository';
import { DrizzleAdminUserRepository } from '../../src/infra/repositories/drizzle-admin-user.repository';
import { DrizzleOtpCodeRepository } from '../../src/infra/repositories/drizzle-otp-code.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const SHOP_ID = 'a3f1c2d4-5b6e-4f70-8192-a3b4c5d6e7f8';
const BLOG_ID = 'b4e2d3c5-6c7f-4081-9203-b4c5d6e7f809';
const NOW = new Date('2026-10-06T14:00:00.000Z');
const MINUTE = 60_000;

function at(offsetMs: number): Date {
  return new Date(NOW.getTime() + offsetMs);
}

describe('admin repositories against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let admins: DrizzleAdminUserRepository;
  let codes: DrizzleOtpCodeRepository;
  let sessions: DrizzleAdminSessionRepository;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    const db = createDrizzleDatabase(app);
    admins = new DrizzleAdminUserRepository(db);
    codes = new DrizzleOtpCodeRepository(db);
    sessions = new DrizzleAdminSessionRepository(db);
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
    await owner`
      INSERT INTO projects (id, name, timezone) VALUES (${SHOP_ID}, 'Shop', 'America/Sao_Paulo'), (${BLOG_ID}, 'Blog', 'UTC')
    `;
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  describe('DrizzleAdminUserRepository', () => {
    it('grants access idempotently, creating the admin once, and lists their projects by name', async () => {
      const admin = await admins.grantAccess('ana@example.com', SHOP_ID);
      await admins.grantAccess('ana@example.com', BLOG_ID);
      await admins.grantAccess('ana@example.com', SHOP_ID);

      expect(admin).toEqual({
        id: expect.any(String) as string,
        email: 'ana@example.com',
        createdAt: expect.any(Date) as Date,
      });
      expect((await admins.projectsOf(admin.id)).map((project) => project.name)).toEqual([
        'Blog',
        'Shop',
      ]);
      const [row] = await owner<{ count: string }[]>`SELECT count(*) FROM admin_users`;
      expect(row?.count).toBe('1');
    });

    it('finds an admin by email and by id, and nothing for strangers', async () => {
      const admin = await admins.grantAccess('ana@example.com', SHOP_ID);

      expect(await admins.findByEmail('ana@example.com')).toEqual(admin);
      expect(await admins.findById(admin.id)).toEqual(admin);
      expect(await admins.findByEmail('stranger@example.com')).toBeNull();
      expect(await admins.findById('ffffffff-ffff-4fff-bfff-ffffffffffff')).toBeNull();
    });

    it('never shows another admin the projects they were not granted', async () => {
      await admins.grantAccess('ana@example.com', SHOP_ID);
      const other = await admins.grantAccess('bruno@example.com', BLOG_ID);

      expect((await admins.projectsOf(other.id)).map((project) => project.id)).toEqual([BLOG_ID]);
    });
  });

  describe('DrizzleOtpCodeRepository', () => {
    it('counts the codes of an email since a moment', async () => {
      await codes.create({
        email: 'ana@example.com',
        codeHash: sha256Hex('1'),
        createdAt: at(-90 * MINUTE),
        expiresAt: at(-80 * MINUTE),
      });
      await codes.create({
        email: 'ana@example.com',
        codeHash: sha256Hex('2'),
        createdAt: at(-10 * MINUTE),
        expiresAt: at(0),
      });
      await codes.create({
        email: 'bruno@example.com',
        codeHash: sha256Hex('3'),
        createdAt: at(-5 * MINUTE),
        expiresAt: at(5 * MINUTE),
      });

      expect(await codes.countCreatedSince('ana@example.com', at(-60 * MINUTE))).toBe(1);
    });

    it('finds the latest unused, unexpired code', async () => {
      await codes.create({
        email: 'ana@example.com',
        codeHash: sha256Hex('old'),
        createdAt: at(-8 * MINUTE),
        expiresAt: at(2 * MINUTE),
      });
      const latest = await codes.create({
        email: 'ana@example.com',
        codeHash: sha256Hex('new'),
        createdAt: at(-1 * MINUTE),
        expiresAt: at(9 * MINUTE),
      });

      expect(await codes.findLatestValid('ana@example.com', NOW)).toEqual(latest);

      await codes.markUsed(latest.id, NOW);
      expect((await codes.findLatestValid('ana@example.com', NOW))?.codeHash).toBe(
        sha256Hex('old'),
      );
      expect(await codes.findLatestValid('ana@example.com', at(3 * MINUTE))).toBeNull();
    });

    it('counts attempts atomically and refuses past the limit, even under parallel guesses', async () => {
      const code = await codes.create({
        email: 'ana@example.com',
        codeHash: sha256Hex('1'),
        createdAt: NOW,
        expiresAt: at(10 * MINUTE),
      });

      const results = await Promise.all(
        Array.from({ length: 8 }, () => codes.consumeAttempt(code.id, 5)),
      );

      expect(results.filter(Boolean)).toHaveLength(5);
      expect(await codes.consumeAttempt(code.id, 5)).toBe(false);
    });
  });

  describe('DrizzleAdminSessionRepository', () => {
    it('stores a session by token hash, touches it and revokes it', async () => {
      const admin = await admins.grantAccess('ana@example.com', SHOP_ID);
      const created = await sessions.create({
        adminUserId: admin.id,
        tokenHash: sha256Hex('token'),
        createdAt: NOW,
      });

      expect(created).toEqual({
        id: expect.any(String) as string,
        adminUserId: admin.id,
        createdAt: NOW,
        lastUsedAt: NOW,
      });

      await sessions.touch(created.id, at(6 * MINUTE));
      expect((await sessions.findLiveByTokenHash(sha256Hex('token')))?.lastUsedAt).toEqual(
        at(6 * MINUTE),
      );

      await sessions.revoke(created.id, at(7 * MINUTE));
      expect(await sessions.findLiveByTokenHash(sha256Hex('token'))).toBeNull();
      expect(await sessions.findLiveByTokenHash(sha256Hex('unknown'))).toBeNull();
    });

    it('has no column for the address or the user agent', async () => {
      const columns = await owner<{ column_name: string }[]>`
        SELECT column_name FROM information_schema.columns WHERE table_name = 'admin_sessions'
      `;

      expect(
        columns
          .map(({ column_name }) => column_name)
          .filter((name) => /agent|address|ip/i.test(name)),
      ).toEqual([]);
    });
  });
});
