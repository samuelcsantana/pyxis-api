import type postgres from 'postgres';
import {
  hashSecretKey,
  PUBLIC_KEY_PREFIX,
  SECRET_KEY_PREFIX,
} from '../../src/domain/keys/project-keys';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleProjectKeyRepository } from '../../src/infra/repositories/drizzle-project-key.repository';
import { DrizzleProjectRepository } from '../../src/infra/repositories/drizzle-project.repository';
import { DrizzleProjectSettingsRepository } from '../../src/infra/repositories/drizzle-project-settings.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const MISSING_ID = 'ffffffff-ffff-4fff-bfff-ffffffffffff';
const SHOP = {
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'America/Sao_Paulo',
  conversionEvent: 'signup_completed',
};

function publicKey(letter: string): string {
  return `${PUBLIC_KEY_PREFIX}${letter.repeat(32)}`;
}

describe('project settings and keys against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let settings: DrizzleProjectSettingsRepository;
  let keys: DrizzleProjectKeyRepository;
  let lookups: DrizzleProjectRepository;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    const db = createDrizzleDatabase(app);
    settings = new DrizzleProjectSettingsRepository(db);
    keys = new DrizzleProjectKeyRepository(db);
    lookups = new DrizzleProjectRepository(db);
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it('creates a project and its first public key together, as the application role', async () => {
    const created = await settings.createWithPublicKey(SHOP, publicKey('A'));

    expect(created.project).toEqual({
      ...SHOP,
      id: expect.any(String) as string,
      createdAt: expect.any(Date) as Date,
    });
    expect((await lookups.findByPublicKey(publicKey('A')))?.id).toBe(created.project.id);
    const [key] = await owner<{ id: string }[]>`SELECT id FROM project_keys`;
    expect(key?.id).toBe(created.publicKeyId);
  });

  it('leaves no project behind when its key cannot be stored', async () => {
    await settings.createWithPublicKey(SHOP, publicKey('A'));

    await expect(
      settings.createWithPublicKey({ ...SHOP, name: 'Copy' }, publicKey('A')),
    ).rejects.toThrow();

    const rows = await owner<{ name: string }[]>`SELECT name FROM projects`;
    expect(rows.map(({ name }) => name)).toEqual(['Shop']);
  });

  it('finds a project by id, and nothing for an unknown id', async () => {
    const { project } = await settings.createWithPublicKey(SHOP, publicKey('A'));

    expect(await settings.findById(project.id)).toEqual(project);
    expect(await settings.findById(MISSING_ID)).toBeNull();
  });

  it('updates only the settings it is given', async () => {
    const { project } = await settings.createWithPublicKey(SHOP, publicKey('A'));

    const updated = await settings.update(project.id, {
      allowedOrigins: ['https://shop.example.com', 'http://localhost:5173'],
      conversionEvent: null,
    });

    expect(updated).toEqual({
      ...project,
      allowedOrigins: ['https://shop.example.com', 'http://localhost:5173'],
      conversionEvent: null,
    });
    expect(await settings.update(project.id, { timezone: 'UTC' })).toMatchObject({
      timezone: 'UTC',
    });
  });

  it('returns the project unchanged when there is nothing to update', async () => {
    const { project } = await settings.createWithPublicKey(SHOP, publicKey('A'));

    expect(await settings.update(project.id, {})).toEqual(project);
  });

  it('updates nothing for an unknown project', async () => {
    expect(await settings.update(MISSING_ID, { timezone: 'UTC' })).toBeNull();
  });

  it('stores a secret key as its hash only', async () => {
    const { project } = await settings.createWithPublicKey(SHOP, publicKey('A'));
    const hash = hashSecretKey(`${SECRET_KEY_PREFIX}${'s'.repeat(32)}`);

    const created = await keys.create({ projectId: project.id, kind: 'secret', secretHash: hash });

    expect(created).toMatchObject({
      projectId: project.id,
      kind: 'secret',
      secretHash: hash,
      revokedAt: null,
    });
    const [row] = await owner<{ public_key: string | null }[]>`
      SELECT public_key FROM project_keys WHERE id = ${created.id}
    `;
    expect(row?.public_key).toBeNull();
  });

  it('adds a second public key that resolves the same project', async () => {
    const { project } = await settings.createWithPublicKey(SHOP, publicKey('A'));

    const created = await keys.create({
      projectId: project.id,
      kind: 'public',
      publicKey: publicKey('B'),
    });

    expect(created).toMatchObject({ kind: 'public', publicKey: publicKey('B') });
    expect((await lookups.findByPublicKey(publicKey('B')))?.id).toBe(project.id);
  });

  it('revokes a live key once, after which it resolves nothing', async () => {
    const { publicKeyId } = await settings.createWithPublicKey(SHOP, publicKey('A'));
    const revokedAt = new Date('2026-10-06T14:00:00.000Z');

    expect(await keys.revoke(publicKeyId, revokedAt)).toBe(true);
    expect(await keys.revoke(publicKeyId, revokedAt)).toBe(false);
    expect(await keys.revoke(MISSING_ID, revokedAt)).toBe(false);
    expect(await lookups.findByPublicKey(publicKey('A'))).toBeNull();
    const [row] = await owner<{ revoked_at: Date }[]>`SELECT revoked_at FROM project_keys`;
    expect(row?.revoked_at).toEqual(revokedAt);
  });
});
