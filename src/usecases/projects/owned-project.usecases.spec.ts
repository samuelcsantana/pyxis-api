import type { AccountStatus } from '../../domain/accounts/account-status';
import {
  AccountNotFoundError,
  AccountSuspendedError,
  DeletionOnHoldError,
  ProjectLimitReachedError,
  SubscriptionRequiredError,
} from '../../domain/errors/account.errors';
import {
  KeyLimitReachedError,
  LastPublicKeyError,
  ProjectKeyNotFoundError,
  ProjectNameMismatchError,
  ProjectNotFoundError,
} from '../../domain/errors/project.errors';
import {
  MAX_LIVE_KEYS_PER_KIND,
  PUBLIC_KEY_PATTERN,
  SECRET_KEY_PATTERN,
} from '../../domain/keys/project-keys';
import { FixedClock } from '../../test-utils/fixed-clock';
import { InMemoryAccountRepository } from '../../test-utils/in-memory-account.repository';
import { InMemoryAdminUserRepository } from '../../test-utils/in-memory-admin-user.repository';
import { InMemoryProjectRepository } from '../../test-utils/in-memory-project.repository';
import { InMemoryProjectDeletionHoldRepository } from '../../test-utils/in-memory-project-deletion-hold.repository';
import { SequenceRandomSource } from '../../test-utils/sequence-random-source';
import { CreateOwnedProjectKeyUseCase } from './create-owned-project-key.usecase';
import { CreateOwnedProjectUseCase } from './create-owned-project.usecase';
import { CreateProjectKeyUseCase } from './create-project-key.usecase';
import { CreateProjectUseCase } from './create-project.usecase';
import { DeleteOwnedProjectUseCase } from './delete-owned-project.usecase';
import { DeleteProjectUseCase } from './delete-project.usecase';
import { RevokeOwnedProjectKeyUseCase } from './revoke-owned-project-key.usecase';
import { UpdateOwnedProjectUseCase } from './update-owned-project.usecase';
import { UpdateProjectUseCase } from './update-project.usecase';

const NOW = new Date('2026-11-03T12:00:00.000Z');
const OWNER_ID = 'ad000000-0000-4000-a000-000000000001';
const STRANGER_ID = 'ad000000-0000-4000-a000-000000000002';
const MISSING_ID = 'ffffffff-ffff-4fff-bfff-ffffffffffff';
const SHOP = { name: 'Shop', allowedOrigins: ['https://shop.example.com'] };

async function setup(status: AccountStatus = 'trialing') {
  const store = new InMemoryProjectRepository();
  const accounts = new InMemoryAccountRepository(new InMemoryAdminUserRepository());
  const random = new SequenceRandomSource(Array.from({ length: 62 }, (_, index) => index));
  const clock = new FixedClock(NOW);
  const account = await accounts.create({ ownerAdminId: OWNER_ID, status });
  store.addAccount(account.id, OWNER_ID);
  const createProject = new CreateProjectUseCase(store, random, accounts);
  const holds = new InMemoryProjectDeletionHoldRepository();
  return {
    store,
    accounts,
    account,
    createProject,
    createOwnedProject: new CreateOwnedProjectUseCase(accounts, createProject),
    updateOwnedProject: new UpdateOwnedProjectUseCase(
      store,
      accounts,
      new UpdateProjectUseCase(store),
    ),
    createOwnedKey: new CreateOwnedProjectKeyUseCase(
      store,
      accounts,
      store,
      new CreateProjectKeyUseCase(store, store, random),
    ),
    revokeOwnedKey: new RevokeOwnedProjectKeyUseCase(store, accounts, store, clock),
    holds,
    deleteOwnedProject: new DeleteOwnedProjectUseCase(
      store,
      accounts,
      holds,
      new DeleteProjectUseCase(store),
    ),
  };
}

async function withProject(status: AccountStatus = 'trialing') {
  const context = await setup(status);
  const created = await context.createProject.execute({ ...SHOP, accountId: context.account.id });
  return { ...context, ...created };
}

async function setStatus(
  accounts: InMemoryAccountRepository,
  accountId: string,
  status: AccountStatus,
): Promise<void> {
  const account = await accounts.findById(accountId);
  if (account === null) {
    throw new Error('no such account');
  }
  accounts.add({ ...account, status });
}

async function suspend(accounts: InMemoryAccountRepository, accountId: string): Promise<void> {
  const account = await accounts.findById(accountId);
  if (account === null) {
    throw new Error('no such account');
  }
  accounts.add({ ...account, suspendedAt: NOW, suspensionReason: 'Forged traffic' });
}

describe('CreateOwnedProjectUseCase', () => {
  it("creates a project in the owner's account, with its public key and the owner's access", async () => {
    const { createOwnedProject, store, account } = await setup();

    const created = await createOwnedProject.execute({
      ...SHOP,
      timezone: 'America/Sao_Paulo',
      adminUserId: OWNER_ID,
      accountId: account.id,
    });

    expect(created.publicKey).toMatch(PUBLIC_KEY_PATTERN);
    expect(store.accountOf(created.projectId)).toBe(account.id);
    expect(store.grantedToOwners).toEqual([
      { adminUserId: OWNER_ID, projectId: created.projectId },
    ]);
    expect((await store.findById(created.projectId))?.timezone).toBe('America/Sao_Paulo');
  });

  it.each(['past_due', 'ending', 'comped'] as const)(
    'lets a %s account create projects',
    async (status) => {
      const { createOwnedProject, account } = await setup(status);

      await expect(
        createOwnedProject.execute({ ...SHOP, adminUserId: OWNER_ID, accountId: account.id }),
      ).resolves.toEqual(expect.objectContaining({ projectId: expect.any(String) as string }));
    },
  );

  it.each(['incomplete', 'ended'] as const)(
    'refuses a project to a %s account, which has no running subscription',
    async (status) => {
      const { createOwnedProject, account, store } = await setup(status);

      await expect(
        createOwnedProject.execute({ ...SHOP, adminUserId: OWNER_ID, accountId: account.id }),
      ).rejects.toBeInstanceOf(SubscriptionRequiredError);
      expect(store.grantedToOwners).toEqual([]);
    },
  );

  it('answers not found to someone who does not own the account, and for no account', async () => {
    const { createOwnedProject, account } = await setup();

    for (const accountId of [account.id, MISSING_ID]) {
      await expect(
        createOwnedProject.execute({ ...SHOP, adminUserId: STRANGER_ID, accountId }),
      ).rejects.toBeInstanceOf(AccountNotFoundError);
    }
  });

  it("keeps the account to the plan's three projects", async () => {
    const { createOwnedProject, account } = await setup();
    const create = () =>
      createOwnedProject.execute({ ...SHOP, adminUserId: OWNER_ID, accountId: account.id });
    await create();
    await create();
    await create();

    await expect(create()).rejects.toBeInstanceOf(ProjectLimitReachedError);
  });
});

describe('UpdateOwnedProjectUseCase', () => {
  it('changes the settings of a project of the owner', async () => {
    const { updateOwnedProject, projectId } = await withProject();

    const updated = await updateOwnedProject.execute({
      adminUserId: OWNER_ID,
      projectId,
      name: 'Store',
      allowedOrigins: ['https://store.example.com'],
      conversionEvent: 'signup_completed',
    });

    expect(updated).toMatchObject({
      name: 'Store',
      allowedOrigins: ['https://store.example.com'],
      conversionEvent: 'signup_completed',
    });
  });

  it("answers not found for someone else's project, the operator's and a missing one", async () => {
    const { updateOwnedProject, projectId, createProject } = await withProject();
    const operators = await createProject.execute(SHOP);

    for (const [adminUserId, id] of [
      [STRANGER_ID, projectId],
      [OWNER_ID, operators.projectId],
      [OWNER_ID, MISSING_ID],
    ] as const) {
      await expect(
        updateOwnedProject.execute({ adminUserId, projectId: id, name: 'Mine' }),
      ).rejects.toBeInstanceOf(ProjectNotFoundError);
    }
  });

  it('refuses changes once the account has ended', async () => {
    const { updateOwnedProject, projectId, accounts, account, store } = await withProject();
    await setStatus(accounts, account.id, 'ended');

    await expect(
      updateOwnedProject.execute({ adminUserId: OWNER_ID, projectId, name: 'Store' }),
    ).rejects.toBeInstanceOf(SubscriptionRequiredError);
    expect((await store.findById(projectId))?.name).toBe('Shop');
  });

  it('refuses changes while the account is suspended, whatever its subscription', async () => {
    const { updateOwnedProject, projectId, accounts, account, store } = await withProject();
    await suspend(accounts, account.id);

    await expect(
      updateOwnedProject.execute({ adminUserId: OWNER_ID, projectId, name: 'Store' }),
    ).rejects.toBeInstanceOf(AccountSuspendedError);
    expect((await store.findById(projectId))?.name).toBe('Shop');
  });
});

describe('CreateOwnedProjectKeyUseCase', () => {
  it('creates a secret key, shown once, and another public key', async () => {
    const { createOwnedKey, projectId, store } = await withProject();

    const secret = await createOwnedKey.execute({
      adminUserId: OWNER_ID,
      projectId,
      kind: 'secret',
    });
    const publicKey = await createOwnedKey.execute({
      adminUserId: OWNER_ID,
      projectId,
      kind: 'public',
    });

    expect(secret.key).toMatch(SECRET_KEY_PATTERN);
    expect(publicKey.key).toMatch(PUBLIC_KEY_PATTERN);
    expect((await store.liveKeysOf(projectId)).map(({ kind }) => kind)).toEqual([
      'public',
      'secret',
      'public',
    ]);
  });

  it('refuses a sixth live key of a kind, but not a key of the other kind', async () => {
    const { createOwnedKey, projectId } = await withProject();
    const create = (kind: 'public' | 'secret') =>
      createOwnedKey.execute({ adminUserId: OWNER_ID, projectId, kind });
    for (let created = 1; created < MAX_LIVE_KEYS_PER_KIND; created += 1) {
      await create('public');
    }

    await expect(create('public')).rejects.toBeInstanceOf(KeyLimitReachedError);
    await expect(create('secret')).resolves.toEqual(expect.objectContaining({ kind: 'secret' }));
  });

  it("answers not found for someone else's project", async () => {
    const { createOwnedKey, projectId } = await withProject();

    await expect(
      createOwnedKey.execute({ adminUserId: STRANGER_ID, projectId, kind: 'secret' }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });
});

describe('RevokeOwnedProjectKeyUseCase', () => {
  it('revokes a key of the project', async () => {
    const { createOwnedKey, revokeOwnedKey, projectId, store } = await withProject();
    const secret = await createOwnedKey.execute({
      adminUserId: OWNER_ID,
      projectId,
      kind: 'secret',
    });

    await revokeOwnedKey.execute({ adminUserId: OWNER_ID, projectId, keyId: secret.keyId });

    expect(store.storedKeys.find(({ id }) => id === secret.keyId)?.revokedAt).toEqual(NOW);
  });

  it('refuses to revoke a key of another project, even one the owner also owns', async () => {
    const { revokeOwnedKey, projectId, createProject, account, store } = await withProject();
    const other = await createProject.execute({ ...SHOP, accountId: account.id });

    await expect(
      revokeOwnedKey.execute({ adminUserId: OWNER_ID, projectId, keyId: other.publicKeyId }),
    ).rejects.toBeInstanceOf(ProjectKeyNotFoundError);
    expect(await store.liveKeysOf(other.projectId)).toHaveLength(1);
  });

  it('keeps the last public key, so the site does not stop sending events', async () => {
    const { createOwnedKey, revokeOwnedKey, projectId, publicKeyId } = await withProject();

    await expect(
      revokeOwnedKey.execute({ adminUserId: OWNER_ID, projectId, keyId: publicKeyId }),
    ).rejects.toBeInstanceOf(LastPublicKeyError);

    await createOwnedKey.execute({ adminUserId: OWNER_ID, projectId, kind: 'public' });
    await expect(
      revokeOwnedKey.execute({ adminUserId: OWNER_ID, projectId, keyId: publicKeyId }),
    ).resolves.toBeUndefined();
  });

  it('answers not found when the key was revoked in between', async () => {
    const { createOwnedKey, revokeOwnedKey, projectId, store } = await withProject();
    const secret = await createOwnedKey.execute({
      adminUserId: OWNER_ID,
      projectId,
      kind: 'secret',
    });
    jest.spyOn(store, 'revoke').mockResolvedValueOnce(false);

    await expect(
      revokeOwnedKey.execute({ adminUserId: OWNER_ID, projectId, keyId: secret.keyId }),
    ).rejects.toBeInstanceOf(ProjectKeyNotFoundError);
  });

  it('refuses once the account has ended', async () => {
    const { revokeOwnedKey, projectId, publicKeyId, accounts, account } = await withProject();
    await setStatus(accounts, account.id, 'ended');

    await expect(
      revokeOwnedKey.execute({ adminUserId: OWNER_ID, projectId, keyId: publicKeyId }),
    ).rejects.toBeInstanceOf(SubscriptionRequiredError);
  });
});

describe('DeleteOwnedProjectUseCase', () => {
  it('deletes a project of the owner, even after the account has ended', async () => {
    const { deleteOwnedProject, projectId, accounts, account, store } = await withProject();
    await setStatus(accounts, account.id, 'ended');

    const deleted = await deleteOwnedProject.execute({
      adminUserId: OWNER_ID,
      projectId,
      confirmName: 'Shop',
    });

    expect(deleted).toEqual(expect.objectContaining({ deletedKeys: 1 }));
    expect(await store.findById(projectId)).toBeNull();
  });

  it('keeps a project of an account whose deletion is held', async () => {
    const { deleteOwnedProject, projectId, accounts, account, store } = await withProject();
    accounts.add({ ...account, deletionHeldAt: NOW, deletionHoldReason: 'Court order' });

    await expect(
      deleteOwnedProject.execute({ adminUserId: OWNER_ID, projectId, confirmName: 'Shop' }),
    ).rejects.toBeInstanceOf(DeletionOnHoldError);
    expect(await store.findById(projectId)).not.toBeNull();
  });

  it('keeps a project whose own deletion is held', async () => {
    const { deleteOwnedProject, projectId, holds, store } = await withProject();
    holds.add(projectId, 'Shop');
    await holds.hold(projectId, 'Court order', NOW);

    await expect(
      deleteOwnedProject.execute({ adminUserId: OWNER_ID, projectId, confirmName: 'Shop' }),
    ).rejects.toBeInstanceOf(DeletionOnHoldError);
    expect(await store.findById(projectId)).not.toBeNull();
  });

  it('keeps the project when the name does not match', async () => {
    const { deleteOwnedProject, projectId } = await withProject();

    await expect(
      deleteOwnedProject.execute({ adminUserId: OWNER_ID, projectId, confirmName: 'shop' }),
    ).rejects.toBeInstanceOf(ProjectNameMismatchError);
  });

  it("answers not found for someone else's project", async () => {
    const { deleteOwnedProject, projectId } = await withProject();

    await expect(
      deleteOwnedProject.execute({ adminUserId: STRANGER_ID, projectId, confirmName: 'Shop' }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });
});
