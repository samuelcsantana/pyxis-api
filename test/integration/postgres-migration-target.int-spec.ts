import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import postgres from 'postgres';
import { applyMigrations } from '../../src/infra/database/migrations';
import {
  createPostgresMigrationTarget,
  hasMigrations,
} from '../../src/infra/database/postgres-migration-target';
import { appRole } from '../local-database';
import { testAppUrl, testOwnerUrl } from './test-database';

const PROBE_MIGRATION =
  'CREATE TABLE "migration_probe" ("id" integer PRIMARY KEY, "label" text NOT NULL);';

function writeMigrationsFolder(root: string): string {
  const folder = path.join(root, 'drizzle');
  mkdirSync(path.join(folder, 'meta'), { recursive: true });
  writeFileSync(path.join(folder, '0000_probe.sql'), PROBE_MIGRATION);
  writeFileSync(
    path.join(folder, 'meta', '_journal.json'),
    JSON.stringify({
      version: '7',
      dialect: 'postgresql',
      entries: [
        { idx: 0, version: '7', when: 1759708800000, tag: '0000_probe', breakpoints: true },
      ],
    }),
  );
  return folder;
}

describe('createPostgresMigrationTarget against a real Postgres', () => {
  let root: string;
  let migrationsFolder: string;
  let appClient: postgres.Sql;

  beforeAll(async () => {
    root = mkdtempSync(path.join(tmpdir(), 'pyxis-migrations-'));
    migrationsFolder = writeMigrationsFolder(root);
    await applyMigrations(
      createPostgresMigrationTarget(testOwnerUrl(), migrationsFolder),
      appRole(),
    );
    appClient = postgres(testAppUrl(), { max: 1, onnotice: () => undefined });
  });

  afterAll(async () => {
    await appClient.end();
    rmSync(root, { recursive: true, force: true });
  });

  it('applies the migrations of the folder', async () => {
    const rows = await appClient<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'migration_probe'
    `;

    expect(rows).toHaveLength(1);
  });

  it('lets the application role read and write rows', async () => {
    await appClient`INSERT INTO migration_probe (id, label) VALUES (1, 'created')`;
    await appClient`UPDATE migration_probe SET label = 'updated' WHERE id = 1`;
    const rows = await appClient<
      { label: string }[]
    >`SELECT label FROM migration_probe WHERE id = 1`;
    await appClient`DELETE FROM migration_probe WHERE id = 1`;

    expect(rows).toEqual([{ label: 'updated' }]);
  });

  it('denies the application role any structural change', async () => {
    await expect(appClient.unsafe('CREATE TABLE intruder (id integer)')).rejects.toThrow(
      /permission denied/,
    );
    await expect(appClient.unsafe('TRUNCATE migration_probe')).rejects.toThrow(/permission denied/);
    await expect(appClient.unsafe('DROP TABLE migration_probe')).rejects.toThrow(/must be owner/);
  });

  it('is idempotent: running it again changes nothing and grants again', async () => {
    await expect(
      applyMigrations(createPostgresMigrationTarget(testOwnerUrl(), migrationsFolder), appRole()),
    ).resolves.toEqual({ grantedTo: appRole() });
  });

  it('refuses to grant to a role that does not exist', async () => {
    await expect(
      applyMigrations(
        createPostgresMigrationTarget(testOwnerUrl(), migrationsFolder),
        'pyxis_missing_role',
      ),
    ).rejects.toThrow('APP_DB_ROLE "pyxis_missing_role" does not exist');
  });

  it('skips the migration step when the folder has no migrations yet', async () => {
    const empty = path.join(root, 'empty');
    mkdirSync(empty);

    expect(hasMigrations(empty)).toBe(false);
    await expect(
      applyMigrations(createPostgresMigrationTarget(testOwnerUrl(), empty), undefined),
    ).resolves.toEqual({ grantedTo: null });
  });

  it('uses the drizzle folder of the repository by default', async () => {
    await expect(
      applyMigrations(createPostgresMigrationTarget(testOwnerUrl()), undefined),
    ).resolves.toEqual({ grantedTo: null });
  });
});
