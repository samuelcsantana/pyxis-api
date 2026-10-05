import type postgres from 'postgres';
import { PUBLIC_KEY_PREFIX } from '../../src/domain/keys/project-keys';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleProjectRepository } from '../../src/infra/repositories/drizzle-project.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const SHOP_ID = 'a3f1c2d4-5b6e-4f70-8192-a3b4c5d6e7f8';
const BLOG_ID = 'b4e2d3c5-6c7f-4081-9203-b4c5d6e7f809';
const SHOP_KEY = `${PUBLIC_KEY_PREFIX}${'S'.repeat(32)}`;
const BLOG_KEY = `${PUBLIC_KEY_PREFIX}${'B'.repeat(32)}`;
const REVOKED_KEY = `${PUBLIC_KEY_PREFIX}${'R'.repeat(32)}`;

describe('DrizzleProjectRepository against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let repository: DrizzleProjectRepository;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    repository = new DrizzleProjectRepository(createDrizzleDatabase(app));
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
    await owner`
      INSERT INTO projects (id, name, allowed_origins, timezone, conversion_event)
      VALUES
        (${SHOP_ID}, 'Shop', ${['https://shop.example.com', 'http://localhost:5173']}, 'America/Sao_Paulo', 'signup_completed'),
        (${BLOG_ID}, 'Blog', ${['https://blog.example.com']}, 'UTC', NULL)
    `;
    await owner`
      INSERT INTO project_keys (project_id, kind, public_key, secret_hash, revoked_at)
      VALUES
        (${SHOP_ID}, 'public', ${SHOP_KEY}, NULL, NULL),
        (${SHOP_ID}, 'public', ${REVOKED_KEY}, NULL, now()),
        (${SHOP_ID}, 'secret', NULL, ${'f'.repeat(64)}, NULL),
        (${BLOG_ID}, 'public', ${BLOG_KEY}, NULL, NULL)
    `;
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it('finds the project of a live public key, as a domain entity', async () => {
    const project = await repository.findByPublicKey(SHOP_KEY);

    expect(project).toEqual({
      id: SHOP_ID,
      name: 'Shop',
      allowedOrigins: ['https://shop.example.com', 'http://localhost:5173'],
      timezone: 'America/Sao_Paulo',
      conversionEvent: 'signup_completed',
      createdAt: expect.any(Date) as Date,
    });
  });

  it('never resolves one project from another project key', async () => {
    expect((await repository.findByPublicKey(BLOG_KEY))?.id).toBe(BLOG_ID);
    expect((await repository.findByPublicKey(SHOP_KEY))?.id).toBe(SHOP_ID);
  });

  it.each([
    ['an unknown key', `${PUBLIC_KEY_PREFIX}${'U'.repeat(32)}`],
    ['a revoked key', REVOKED_KEY],
    ['a secret hash offered as a public key', 'f'.repeat(64)],
  ])('finds nothing for %s', async (_, key) => {
    expect(await repository.findByPublicKey(key)).toBeNull();
  });

  it('refuses a key row that holds both a public key and a secret hash', async () => {
    await expect(
      owner`
        INSERT INTO project_keys (project_id, kind, public_key, secret_hash)
        VALUES (${SHOP_ID}, 'public', ${`${PUBLIC_KEY_PREFIX}${'X'.repeat(32)}`}, ${'e'.repeat(64)})
      `,
    ).rejects.toThrow(/project_keys_kind_matches_value/);
  });

  it('refuses the same public key twice', async () => {
    await expect(
      owner`
        INSERT INTO project_keys (project_id, kind, public_key) VALUES (${BLOG_ID}, 'public', ${SHOP_KEY})
      `,
    ).rejects.toThrow(/project_keys_public_key_unique/);
  });
});
