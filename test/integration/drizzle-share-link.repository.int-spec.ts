import type postgres from 'postgres';
import { sha256Hex } from '../../src/domain/auth/hashing';
import { PUBLIC_KEY_PREFIX } from '../../src/domain/keys/project-keys';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleProjectSettingsRepository } from '../../src/infra/repositories/drizzle-project-settings.repository';
import { DrizzleShareLinkRepository } from '../../src/infra/repositories/drizzle-share-link.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const MISSING_ID = 'ffffffff-ffff-4fff-bfff-ffffffffffff';
const CREATED_AT = new Date('2026-11-05T12:00:00.000Z');
const LATER = new Date('2026-11-05T12:00:01.000Z');
const EXPIRES_AT = new Date('2026-12-05T12:00:00.000Z');
const SHOP = {
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'UTC',
  conversionEvent: null,
};

function publicKey(letter: string): string {
  return `${PUBLIC_KEY_PREFIX}${letter.repeat(32)}`;
}

function tokenHash(letter: string): string {
  return sha256Hex(`pyxis_sh_${letter.repeat(32)}`);
}

describe('share links against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let links: DrizzleShareLinkRepository;
  let settings: DrizzleProjectSettingsRepository;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    const db = createDrizzleDatabase(app);
    links = new DrizzleShareLinkRepository(db);
    settings = new DrizzleProjectSettingsRepository(db);
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  async function newProject(letter = 'A'): Promise<string> {
    const { project } = await settings.createWithPublicKey(
      { ...SHOP, name: `Shop ${letter}` },
      publicKey(letter),
    );
    return project.id;
  }

  function draft(projectId: string, letter: string, createdAt = CREATED_AT) {
    return {
      projectId,
      name: `Link ${letter}`,
      tokenHash: tokenHash(letter),
      createdAt,
      expiresAt: null,
    };
  }

  it('stores the hash, never the token, and answers the link without it', async () => {
    const projectId = await newProject();

    const created = await links.create({ ...draft(projectId, 'a'), expiresAt: EXPIRES_AT }, 10);

    expect(created).toEqual({
      outcome: 'created',
      link: {
        id: expect.any(String) as string,
        projectId,
        name: 'Link a',
        createdAt: CREATED_AT,
        expiresAt: EXPIRES_AT,
      },
    });
    const [row] = await owner<{ token_hash: string; password_hash: string | null }[]>`
      SELECT token_hash, password_hash FROM share_links WHERE project_id = ${projectId}`;
    expect(row).toEqual({ token_hash: tokenHash('a'), password_hash: null });
  });

  it('finds a link by the hash of its token, and nothing for another hash', async () => {
    const projectId = await newProject();
    await links.create(draft(projectId, 'a'), 10);

    await expect(links.findByTokenHash(tokenHash('a'))).resolves.toMatchObject({
      projectId,
      name: 'Link a',
      expiresAt: null,
    });
    await expect(links.findByTokenHash(tokenHash('b'))).resolves.toBeNull();
  });

  it('stops at the limit of each project, counting only its own links', async () => {
    const shop = await newProject('A');
    const blog = await newProject('B');
    await links.create(draft(shop, 'a'), 1);

    await expect(links.create(draft(shop, 'b'), 1)).resolves.toEqual({
      outcome: 'limit_reached',
    });
    await expect(links.create(draft(blog, 'c'), 1)).resolves.toMatchObject({
      outcome: 'created',
    });
  });

  it('refuses a second link with the same token hash', async () => {
    const shop = await newProject('A');
    const blog = await newProject('B');
    await links.create(draft(shop, 'a'), 10);

    await expect(links.create(draft(blog, 'a'), 10)).rejects.toThrow();
  });

  it('lists the links of one project, the oldest first', async () => {
    const shop = await newProject('A');
    const blog = await newProject('B');
    await links.create(draft(shop, 'b', LATER), 10);
    await links.create(draft(shop, 'a'), 10);
    await links.create(draft(blog, 'c'), 10);

    const listed = await links.listByProject(shop);

    expect(listed.map((link) => link.name)).toEqual(['Link a', 'Link b']);
  });

  it("deletes a link of its project only, and never another project's", async () => {
    const shop = await newProject('A');
    const blog = await newProject('B');
    const created = await links.create(draft(shop, 'a'), 10);
    if (created.outcome !== 'created') {
      throw new Error('The link was not created.');
    }

    await expect(links.delete(blog, created.link.id)).resolves.toBe(false);
    await expect(links.delete(shop, MISSING_ID)).resolves.toBe(false);
    await expect(links.delete(shop, created.link.id)).resolves.toBe(true);
    await expect(links.findByTokenHash(tokenHash('a'))).resolves.toBeNull();
  });

  it('goes with its project when the project is deleted', async () => {
    const projectId = await newProject();
    await links.create(draft(projectId, 'a'), 10);

    await owner`DELETE FROM projects WHERE id = ${projectId}`;

    await expect(links.findByTokenHash(tokenHash('a'))).resolves.toBeNull();
  });
});
