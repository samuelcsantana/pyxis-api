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

  it('deletes a project with the migration connection, once its name confirms it', async () => {
    const context = openCliContext({ MIGRATION_DATABASE_URL: testOwnerUrl() });
    try {
      const project = await context.createProject.execute({
        name: 'Shop',
        allowedOrigins: ['https://shop.example.com'],
      });

      const deleted = await context.deleteProject.execute({
        projectId: project.projectId,
        confirmName: 'Shop',
      });

      expect(deleted).toMatchObject({ deletedEvents: 0, deletedKeys: 1 });
      const rows = await owner`SELECT id FROM projects`;
      expect(rows).toHaveLength(0);
    } finally {
      await context.close();
    }
  });

  it('opens a free account, creates its projects up to the plan limit and shows it', async () => {
    const context = openCliContext({ MIGRATION_DATABASE_URL: testOwnerUrl() });
    try {
      const account = await context.createCompedAccount.execute({
        ownerEmail: 'friend@example.com',
      });
      for (const name of ['one', 'two', 'three']) {
        await context.createProject.execute({
          name,
          allowedOrigins: [`https://${name}.example.com`],
          accountId: account.accountId,
        });
      }

      await expect(
        context.createProject.execute({
          name: 'four',
          allowedOrigins: ['https://four.example.com'],
          accountId: account.accountId,
        }),
      ).rejects.toMatchObject({ code: 'project_limit_reached' });
      const summary = await context.showAccount.execute({ accountId: account.accountId });
      expect(summary).toMatchObject({
        account: { status: 'comped' },
        ownerEmail: 'friend@example.com',
        people: 1,
      });
      expect(summary.projects.map(({ name }) => name)).toEqual(['one', 'two', 'three']);
    } finally {
      await context.close();
    }
  });

  it('grants a project to an admin, creating the admin once, and revokes it', async () => {
    const context = openCliContext({ MIGRATION_DATABASE_URL: testOwnerUrl() });
    try {
      const project = await context.createProject.execute({
        name: 'Shop',
        allowedOrigins: ['https://shop.example.com'],
      });

      const first = await context.grantAdminAccess.execute({
        email: 'ana@example.com',
        projectId: project.projectId,
      });
      const again = await context.grantAdminAccess.execute({
        email: 'ana@example.com',
        projectId: project.projectId,
      });

      expect(again.adminUserId).toBe(first.adminUserId);
      const access = await owner<{ email: string; project_id: string }[]>`
        SELECT admin_users.email, admin_project_access.project_id
        FROM admin_project_access JOIN admin_users ON admin_users.id = admin_project_access.admin_user_id
      `;
      expect(access).toEqual([{ email: 'ana@example.com', project_id: project.projectId }]);

      await context.revokeAdminAccess.execute({
        email: 'ana@example.com',
        projectId: project.projectId,
      });
      expect(await owner`SELECT 1 FROM admin_project_access`).toHaveLength(0);
    } finally {
      await context.close();
    }
  });

  it('suspends an account and lifts the suspension with the migration connection', async () => {
    const context = openCliContext({ MIGRATION_DATABASE_URL: testOwnerUrl() });
    try {
      const account = await context.createCompedAccount.execute({
        ownerEmail: 'suspended@example.com',
      });

      await context.suspendAccount.execute({
        accountId: account.accountId,
        reason: 'Forged traffic',
      });
      const [suspended] = await owner<{ suspension_reason: string | null }[]>`
        SELECT suspension_reason FROM accounts WHERE id = ${account.accountId}
      `;
      expect(suspended?.suspension_reason).toBe('Forged traffic');

      await context.resumeAccount.execute({ accountId: account.accountId });
      const [resumed] = await owner<{ suspended_at: Date | null }[]>`
        SELECT suspended_at FROM accounts WHERE id = ${account.accountId}
      `;
      expect(resumed?.suspended_at).toBeNull();
    } finally {
      await context.close();
    }
  });

  it('closes an account as the operator, revoking its keys at once', async () => {
    const context = openCliContext({ MIGRATION_DATABASE_URL: testOwnerUrl() });
    try {
      const account = await context.createCompedAccount.execute({
        ownerEmail: 'closed@example.com',
      });
      const project = await context.createProject.execute({
        name: 'Shop',
        allowedOrigins: ['https://shop.example.com'],
        accountId: account.accountId,
      });

      const closed = await context.closeAccountAsOperator.execute({
        accountId: account.accountId,
        refund: 'full',
      });

      expect(closed).toMatchObject({ subscriptionCancelled: false, refundedAmount: 0 });
      const [row] = await owner<{ status: string; ended_notified_at: Date | null }[]>`
        SELECT status, ended_notified_at FROM accounts WHERE id = ${account.accountId}
      `;
      expect(row).toEqual({ status: 'ended', ended_notified_at: null });
      const live = await owner`
        SELECT id FROM project_keys WHERE project_id = ${project.projectId} AND revoked_at IS NULL
      `;
      expect(live).toHaveLength(0);
    } finally {
      await context.close();
    }
  });

  it('holds the deletion of an account and releases it with the migration connection', async () => {
    const context = openCliContext({ MIGRATION_DATABASE_URL: testOwnerUrl() });
    try {
      const account = await context.createCompedAccount.execute({ ownerEmail: 'held@example.com' });

      await context.holdAccountDeletion.execute({
        accountId: account.accountId,
        reason: 'Court order',
      });
      const [held] = await owner<{ deletion_hold_reason: string | null }[]>`
        SELECT deletion_hold_reason FROM accounts WHERE id = ${account.accountId}
      `;
      expect(held?.deletion_hold_reason).toBe('Court order');

      await context.releaseAccountDeletion.execute({ accountId: account.accountId });
      const [released] = await owner<{ deletion_held_at: Date | null }[]>`
        SELECT deletion_held_at FROM accounts WHERE id = ${account.accountId}
      `;
      expect(released?.deletion_held_at).toBeNull();
    } finally {
      await context.close();
    }
  });

  it('suspends a person and lifts it, and revokes a token, with the migration connection', async () => {
    const context = openCliContext({ MIGRATION_DATABASE_URL: testOwnerUrl() });
    try {
      const project = await context.createProject.execute({
        name: 'Shop',
        allowedOrigins: ['https://shop.example.com'],
      });
      const ana = await context.grantAdminAccess.execute({
        email: 'ana@example.com',
        projectId: project.projectId,
      });
      const [token] = await owner<{ id: string }[]>`
        INSERT INTO admin_access_tokens (admin_user_id, name, token_hash, created_at, expires_at)
        VALUES (${ana.adminUserId}, 'Agent', ${'c'.repeat(64)}, now(), now() + interval '30 days')
        RETURNING id
      `;

      const suspended = await context.suspendAdmin.execute({ email: 'ana@example.com' });
      expect(suspended).toMatchObject({ tokensRevoked: 1, sessionsEnded: 0 });
      await context.resumeAdmin.execute({ email: 'ana@example.com' });
      const [admin] = await owner<{ suspended_at: Date | null }[]>`
        SELECT suspended_at FROM admin_users WHERE id = ${ana.adminUserId}
      `;
      expect(admin?.suspended_at).toBeNull();
      await expect(
        context.revokeAccessToken.execute({ tokenId: token?.id ?? '' }),
      ).rejects.toMatchObject({
        code: 'access_token_not_found',
      });
    } finally {
      await context.close();
    }
  });

  it("suspends a project's reception and lifts it with the migration connection", async () => {
    const context = openCliContext({ MIGRATION_DATABASE_URL: testOwnerUrl() });
    try {
      const project = await context.createProject.execute({
        name: 'Shop',
        allowedOrigins: ['https://shop.example.com'],
      });

      const suspended = await context.suspendProjectIngestion.execute({
        projectId: project.projectId,
        reason: 'Forged traffic',
      });
      expect(suspended).toMatchObject({ projectName: 'Shop', reason: 'Forged traffic' });
      await context.resumeProjectIngestion.execute({ projectId: project.projectId });
      const [row] = await owner<{ ingestion_suspended_at: Date | null }[]>`
        SELECT ingestion_suspended_at FROM projects WHERE id = ${project.projectId}
      `;
      expect(row?.ingestion_suspended_at).toBeNull();
    } finally {
      await context.close();
    }
  });

  it("holds a project's deletion and releases it with the migration connection", async () => {
    const context = openCliContext({ MIGRATION_DATABASE_URL: testOwnerUrl() });
    try {
      const project = await context.createProject.execute({
        name: 'Shop',
        allowedOrigins: ['https://shop.example.com'],
      });

      const held = await context.holdProjectDeletion.execute({
        projectId: project.projectId,
        reason: 'Court order',
      });
      expect(held).toMatchObject({ projectName: 'Shop', reason: 'Court order' });
      await context.releaseProjectDeletion.execute({ projectId: project.projectId });
      const [row] = await owner<{ deletion_held_at: Date | null }[]>`
        SELECT deletion_held_at FROM projects WHERE id = ${project.projectId}
      `;
      expect(row?.deletion_held_at).toBeNull();
    } finally {
      await context.close();
    }
  });

  it('exempts an account from the pause and ends it with the migration connection', async () => {
    const context = openCliContext({ MIGRATION_DATABASE_URL: testOwnerUrl() });
    try {
      const comped = await context.createCompedAccount.execute({
        ownerEmail: 'exempt@example.com',
      });
      await owner`
        UPDATE accounts SET status = 'active', ingestion_paused_until = '2026-11-01T00:00:00Z'
        WHERE id = ${comped.accountId}
      `;

      const exempted = await context.exemptAccountFromQuotaPause.execute({
        accountId: comped.accountId,
        until: new Date('2027-01-15T00:00:00.000Z'),
      });
      expect(exempted).toMatchObject({
        quotaPauseExemptUntil: new Date('2027-01-15T00:00:00.000Z'),
        ingestionPausedUntil: null,
      });
      const cleared = await context.exemptAccountFromQuotaPause.execute({
        accountId: comped.accountId,
        until: null,
      });
      expect(cleared.quotaPauseExemptUntil).toBeNull();
      for (const until of [null, new Date('2027-01-15T00:00:00.000Z')]) {
        await expect(
          context.exemptAccountFromQuotaPause.execute({
            accountId: 'ffffffff-ffff-4fff-bfff-ffffffffffff',
            until,
          }),
        ).rejects.toMatchObject({ code: 'account_not_found' });
      }
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
