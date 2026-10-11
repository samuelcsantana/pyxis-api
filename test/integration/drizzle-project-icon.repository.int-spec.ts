import type postgres from 'postgres';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleProjectIconRepository } from '../../src/infra/repositories/drizzle-project-icon.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const SHOP_ID = 'a3f1c2d4-5b6e-4f70-8192-a3b4c5d6e7f8';
const BLOG_ID = 'b4e2d3c5-6c7f-4081-9203-b4c5d6e7f809';
const DRAFT_ID = 'c5f3e4d6-7d80-4192-a314-c5d6e7f8091a';
const FETCHED_AT = new Date('2026-10-11T06:00:00.000Z');
const EVERY_BYTE = Uint8Array.from({ length: 256 }, (_, index) => index);

function icon(projectId: string, bytes: Uint8Array, version: string) {
  return {
    projectId,
    contentType: 'image/png' as const,
    bytes,
    version,
    sourceUrl: 'https://shop.example.com/icon.png',
    fetchedAt: FETCHED_AT,
  };
}

describe('DrizzleProjectIconRepository against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let repository: DrizzleProjectIconRepository;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    repository = new DrizzleProjectIconRepository(createDrizzleDatabase(app));
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
    await owner`
      INSERT INTO projects (id, name, allowed_origins)
      VALUES
        (${SHOP_ID}, 'Shop', ${['https://shop.example.com', 'http://localhost:5173']}),
        (${BLOG_ID}, 'Blog', ${['https://blog.example.com']}),
        (${DRAFT_ID}, 'Draft', ${[]})
    `;
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it('lists the first allowed origin of every project that has one, by name', async () => {
    await expect(repository.sites()).resolves.toEqual([
      { projectId: BLOG_ID, origin: 'https://blog.example.com' },
      { projectId: SHOP_ID, origin: 'https://shop.example.com' },
    ]);
  });

  it('keeps every byte of an icon exactly, through the connection the Lambda uses', async () => {
    await repository.save(icon(SHOP_ID, EVERY_BYTE, 'a1b2c3d4e5f60718'));

    const stored = await repository.find(SHOP_ID);

    expect(stored).toEqual(icon(SHOP_ID, EVERY_BYTE, 'a1b2c3d4e5f60718'));
    expect(stored?.bytes).toBeInstanceOf(Uint8Array);
  });

  it('replaces the icon of a project when it is saved again', async () => {
    await repository.save(icon(SHOP_ID, Uint8Array.from([1, 2, 3]), '1111111111111111'));
    await repository.save(icon(SHOP_ID, Uint8Array.from([4, 5]), '2222222222222222'));

    const stored = await repository.find(SHOP_ID);

    expect(stored?.bytes).toEqual(Uint8Array.from([4, 5]));
    expect(stored?.version).toBe('2222222222222222');
  });

  it('finds nothing for a project without an icon, and after the icon is removed', async () => {
    await repository.save(icon(SHOP_ID, Uint8Array.from([1]), '1111111111111111'));

    await expect(repository.find(BLOG_ID)).resolves.toBeNull();
    await repository.remove(SHOP_ID);
    await expect(repository.find(SHOP_ID)).resolves.toBeNull();
  });

  it('tells the version of each project that has an icon', async () => {
    await repository.save(icon(SHOP_ID, Uint8Array.from([1]), '1111111111111111'));

    await expect(repository.versionsOf([SHOP_ID, BLOG_ID])).resolves.toEqual(
      new Map([[SHOP_ID, '1111111111111111']]),
    );
    await expect(repository.versionsOf([])).resolves.toEqual(new Map());
  });

  it('forgets the icon when its project is deleted', async () => {
    await repository.save(icon(SHOP_ID, Uint8Array.from([1]), '1111111111111111'));

    await owner`DELETE FROM projects WHERE id = ${SHOP_ID}`;

    const [{ count } = { count: -1 }] = await owner<{ count: number }[]>`
      SELECT count(*)::int AS count FROM project_icons
    `;
    expect(count).toBe(0);
  });
});
