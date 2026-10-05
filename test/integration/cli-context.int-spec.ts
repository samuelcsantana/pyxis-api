import type postgres from 'postgres';
import { openCliContext } from '../../src/cli/cli-context';
import { hashSecretKey } from '../../src/domain/keys/project-keys';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testOwnerUrl } from './test-database';

describe('openCliContext against a real Postgres', () => {
  let owner: postgres.Sql;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
  });

  afterAll(async () => {
    await owner.end();
  });

  it('runs the project scripts end to end with the migration connection', async () => {
    const context = openCliContext({ MIGRATION_DATABASE_URL: testOwnerUrl() });
    try {
      const project = await context.createProject.execute({
        name: 'Shop',
        allowedOrigins: ['https://shop.example.com'],
      });
      const secret = await context.createProjectKey.execute({
        projectId: project.projectId,
        kind: 'secret',
      });
      await context.updateProject.execute({
        projectId: project.projectId,
        timezone: 'Europe/Lisbon',
      });
      await context.revokeProjectKey.execute(project.publicKeyId);

      const keys = await owner<{ kind: string; secret_hash: string | null; revoked: boolean }[]>`
        SELECT kind, secret_hash, revoked_at IS NOT NULL AS revoked FROM project_keys ORDER BY kind
      `;
      expect(keys).toEqual([
        { kind: 'public', secret_hash: null, revoked: true },
        { kind: 'secret', secret_hash: hashSecretKey(secret.key), revoked: false },
      ]);
      const [row] = await owner<{ timezone: string }[]>`SELECT timezone FROM projects`;
      expect(row?.timezone).toBe('Europe/Lisbon');
    } finally {
      await context.close();
    }
  });

  it('refuses to start without a database URL', () => {
    expect(() => openCliContext({})).toThrow(
      'MIGRATION_DATABASE_URL (or DATABASE_URL) is required',
    );
  });
});
