import type postgres from 'postgres';
import { sha256Hex } from '../../src/domain/auth/hashing';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleAccessTokenRepository } from '../../src/infra/repositories/drizzle-access-token.repository';
import { DrizzleAdminUserRepository } from '../../src/infra/repositories/drizzle-admin-user.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const SHOP_ID = 'c5f3e4d6-7d8a-4192-a314-c5d6e7f8091a';
const NOW = new Date('2026-10-14T12:00:00.000Z');
const DAY = 86_400_000;

function at(offsetMs: number): Date {
  return new Date(NOW.getTime() + offsetMs);
}

describe('DrizzleAccessTokenRepository against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let tokens: DrizzleAccessTokenRepository;
  let anaId: string;
  let brunoId: string;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    tokens = new DrizzleAccessTokenRepository(createDrizzleDatabase(app));
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
    await owner`INSERT INTO projects (id, name) VALUES (${SHOP_ID}, 'Shop')`;
    const admins = new DrizzleAdminUserRepository(createDrizzleDatabase(app));
    anaId = (await admins.grantAccess('ana@example.com', SHOP_ID)).id;
    brunoId = (await admins.grantAccess('bruno@example.com', SHOP_ID)).id;
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  function create(adminUserId: string, name: string, createdAt: Date, lifetimeMs = 30 * DAY) {
    return tokens.create({
      adminUserId,
      name,
      tokenHash: sha256Hex(`${name}-${adminUserId}`),
      createdAt,
      expiresAt: new Date(createdAt.getTime() + lifetimeMs),
    });
  }

  it('stores a token by its hash, finds it, records its use and revokes it for its admin only', async () => {
    const created = await create(anaId, 'Claude Code', NOW);

    expect(created).toEqual({
      id: expect.any(String) as string,
      adminUserId: anaId,
      name: 'Claude Code',
      createdAt: NOW,
      lastUsedAt: null,
      expiresAt: at(30 * DAY),
    });
    expect(await tokens.findLiveByTokenHash(sha256Hex(`Claude Code-${anaId}`))).toEqual(created);

    await tokens.touch(created.id, at(DAY));
    expect((await tokens.listLiveOf(anaId, NOW))[0]?.lastUsedAt).toEqual(at(DAY));

    expect(await tokens.revokeOneOf(brunoId, created.id, NOW)).toBe(false);
    expect(await tokens.revokeOneOf(anaId, created.id, NOW)).toBe(true);
    expect(await tokens.revokeOneOf(anaId, created.id, NOW)).toBe(false);
    expect(await tokens.findLiveByTokenHash(sha256Hex(`Claude Code-${anaId}`))).toBeNull();
  });

  it("revokes every live token of one admin, or any admin's token by its id, once", async () => {
    const first = await create(anaId, 'Claude Code', NOW);
    await create(anaId, 'Cursor', NOW);
    const brunos = await create(brunoId, 'Codex', NOW);

    expect(await tokens.revokeAllOf(anaId, NOW)).toBe(2);
    expect(await tokens.revokeAllOf(anaId, NOW)).toBe(0);
    expect(await tokens.revoke(first.id, NOW)).toBe(false);
    expect(await tokens.revoke(brunos.id, NOW)).toBe(true);
    expect(await tokens.revoke(brunos.id, NOW)).toBe(false);
    expect(await tokens.listLiveOf(brunoId, NOW)).toEqual([]);
  });

  it('lists the live tokens of one admin, newest first, without the expired or revoked', async () => {
    const old = await create(anaId, 'old', at(-2 * DAY));
    const expired = await create(anaId, 'expired', at(-40 * DAY));
    const revoked = await create(anaId, 'revoked', at(-DAY));
    const newest = await create(anaId, 'newest', NOW);
    await create(brunoId, 'his', NOW);
    await tokens.revokeOneOf(anaId, revoked.id, NOW);

    const listed = await tokens.listLiveOf(anaId, NOW);

    expect(listed.map((token) => token.id)).toEqual([newest.id, old.id]);
    expect(listed.map((token) => token.id)).not.toContain(expired.id);
  });

  it('keeps only the hash of a token, and loses the tokens with their admin', async () => {
    await create(anaId, 'Claude Code', NOW);

    const columns = await owner<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'admin_access_tokens' ORDER BY column_name
    `;
    expect(columns.map((column) => column.column_name)).toEqual([
      'admin_user_id',
      'created_at',
      'expires_at',
      'id',
      'last_used_at',
      'name',
      'revoked_at',
      'token_hash',
    ]);

    await owner`DELETE FROM admin_users WHERE id = ${anaId}`;
    const [row] = await owner<{ total: number }[]>`
      SELECT count(*)::int AS total FROM admin_access_tokens
    `;
    expect(row?.total).toBe(0);
  });
});
