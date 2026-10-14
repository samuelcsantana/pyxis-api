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
import type { TrackedEvent } from '../../src/domain/entities/tracked-event.entity';
import { DrizzleEventRepository } from '../../src/infra/repositories/drizzle-event.repository';
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

let eventSequence = 0;

function pageView(projectId: string): TrackedEvent {
  eventSequence += 1;
  const at = new Date('2026-10-06T14:00:00.000Z');
  return {
    id: `e1e1e1e1-0000-4000-8000-${String(eventSequence).padStart(12, '0')}`,
    projectId,
    name: 'page_view',
    occurredAt: at,
    receivedAt: at,
    sessionId: 'e2e2e2e2-0000-4000-8000-000000000001',
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

describe('project settings and keys against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let settings: DrizzleProjectSettingsRepository;
  let keys: DrizzleProjectKeyRepository;
  let lookups: DrizzleProjectRepository;
  let events: DrizzleEventRepository;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    const db = createDrizzleDatabase(app);
    settings = new DrizzleProjectSettingsRepository(db);
    keys = new DrizzleProjectKeyRepository(db);
    lookups = new DrizzleProjectRepository(db);
    events = new DrizzleEventRepository(db);
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

  it('lists the live keys of a project, oldest first, and no key of another project', async () => {
    const { project, publicKeyId } = await settings.createWithPublicKey(SHOP, publicKey('A'));
    const other = await settings.createWithPublicKey({ ...SHOP, name: 'Other' }, publicKey('C'));
    const secret = await keys.create({
      projectId: project.id,
      kind: 'secret',
      secretHash: hashSecretKey(`${SECRET_KEY_PREFIX}${'s'.repeat(32)}`),
    });
    const revoked = await keys.create({
      projectId: project.id,
      kind: 'public',
      publicKey: publicKey('B'),
    });
    await keys.revoke(revoked.id, new Date('2026-10-06T14:00:00.000Z'));

    const live = await keys.liveKeysOf(project.id);

    expect(live.map((key) => key.id)).toEqual([publicKeyId, secret.id]);
    expect(live[0]).toMatchObject({ kind: 'public', publicKey: publicKey('A'), revokedAt: null });
    expect((await keys.liveKeysOf(other.project.id)).map((key) => key.id)).toEqual([
      other.publicKeyId,
    ]);
    expect(await keys.liveKeysOf(MISSING_ID)).toEqual([]);
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

  it('deletes a project with its events, keys and grants, leaving the other projects alone', async () => {
    const shop = await settings.createWithPublicKey(SHOP, publicKey('A'));
    const blog = await settings.createWithPublicKey({ ...SHOP, name: 'Blog' }, publicKey('B'));
    await keys.create({
      projectId: shop.project.id,
      kind: 'secret',
      secretHash: hashSecretKey(`${SECRET_KEY_PREFIX}${'C'.repeat(32)}`),
    });
    await events.insertMany([
      pageView(shop.project.id),
      pageView(shop.project.id),
      pageView(blog.project.id),
    ]);
    const [admin] = await owner<{ id: string }[]>`
      INSERT INTO admin_users (email) VALUES ('ana@example.com') RETURNING id
    `;
    const adminId = admin?.id ?? '';
    await owner`
      INSERT INTO admin_project_access (admin_user_id, project_id)
      VALUES (${adminId}, ${shop.project.id}), (${adminId}, ${blog.project.id})
    `;

    const deleted = await settings.deleteWithEverything(shop.project.id);

    expect(deleted).toEqual({ project: shop.project, deletedEvents: 2, deletedKeys: 2 });
    const remaining = await owner<
      { projects: number; events: number; keys: number; grants: number }[]
    >`
      SELECT
        (SELECT count(*)::int FROM projects) AS projects,
        (SELECT count(*)::int FROM events) AS events,
        (SELECT count(*)::int FROM project_keys) AS keys,
        (SELECT count(*)::int FROM admin_project_access) AS grants
    `;
    expect(remaining).toEqual([{ projects: 1, events: 1, keys: 1, grants: 1 }]);
    expect(await settings.findById(blog.project.id)).toEqual(blog.project);
  });

  it('deletes nothing and answers null for a project that does not exist', async () => {
    await settings.createWithPublicKey(SHOP, publicKey('A'));

    expect(await settings.deleteWithEverything(MISSING_ID)).toBeNull();
    const [row] = await owner<{ total: number }[]>`SELECT count(*)::int AS total FROM projects`;
    expect(row?.total).toBe(1);
  });

  describe('in an account', () => {
    const OWNER_ID = 'd1d2d3d4-0000-4000-8000-000000000001';
    const ACCOUNT_ID = 'd1d2d3d4-0000-4000-8000-000000000002';
    const SLOT = { accountId: ACCOUNT_ID, maxProjects: 2 };

    beforeEach(async () => {
      await owner`INSERT INTO admin_users (id, email) VALUES (${OWNER_ID}, 'owner@example.com')`;
      await owner`
        INSERT INTO accounts (id, owner_admin_id, status) VALUES (${ACCOUNT_ID}, ${OWNER_ID}, 'comped')
      `;
    });

    it('creates the project in the account, with its key, readable by the owner', async () => {
      const result = await settings.createWithPublicKeyInAccount(SHOP, publicKey('A'), SLOT);

      expect(result.outcome).toBe('created');
      const rows = await owner<{ account_id: string; admin_user_id: string }[]>`
        SELECT p.account_id, a.admin_user_id
        FROM projects p JOIN admin_project_access a ON a.project_id = p.id
      `;
      expect(rows).toEqual([{ account_id: ACCOUNT_ID, admin_user_id: OWNER_ID }]);
      expect((await lookups.findByPublicKey(publicKey('A')))?.name).toBe('Shop');
    });

    it('answers that the account does not exist and stores nothing', async () => {
      const result = await settings.createWithPublicKeyInAccount(SHOP, publicKey('A'), {
        ...SLOT,
        accountId: MISSING_ID,
      });

      expect(result).toEqual({ outcome: 'account_not_found' });
      const [row] = await owner<{ total: number }[]>`SELECT count(*)::int AS total FROM projects`;
      expect(row?.total).toBe(0);
    });

    it('stops at the limit, counting only the projects of that account', async () => {
      await settings.createWithPublicKey({ ...SHOP, name: 'Operator' }, publicKey('O'));
      await settings.createWithPublicKeyInAccount(SHOP, publicKey('A'), SLOT);
      await settings.createWithPublicKeyInAccount({ ...SHOP, name: 'Blog' }, publicKey('B'), SLOT);

      const refused = await settings.createWithPublicKeyInAccount(
        { ...SHOP, name: 'Third' },
        publicKey('C'),
        SLOT,
      );

      expect(refused).toEqual({ outcome: 'project_limit_reached' });
      expect(await lookups.findByPublicKey(publicKey('C'))).toBeNull();
    });

    it('lets only one of two simultaneous requests take the last place', async () => {
      await settings.createWithPublicKeyInAccount(SHOP, publicKey('A'), SLOT);
      const second = createPostgresClient(testAppUrl());
      try {
        const racing = new DrizzleProjectSettingsRepository(createDrizzleDatabase(second));

        const outcomes = await Promise.all([
          settings.createWithPublicKeyInAccount({ ...SHOP, name: 'B' }, publicKey('B'), SLOT),
          racing.createWithPublicKeyInAccount({ ...SHOP, name: 'C' }, publicKey('C'), SLOT),
        ]);

        expect(outcomes.map(({ outcome }) => outcome).sort()).toEqual([
          'created',
          'project_limit_reached',
        ]);
        const [row] = await owner<{ total: number }[]>`
          SELECT count(*)::int AS total FROM projects WHERE account_id = ${ACCOUNT_ID}
        `;
        expect(row?.total).toBe(2);
      } finally {
        await second.end();
      }
    });
  });
});
