import { HOSTED_PLAN_LIMITS } from '../../domain/accounts/hosted-plan';
import type { Project } from '../../domain/entities/project.entity';
import { AccountNotFoundError } from '../../domain/errors/account.errors';
import { InMemoryAccountRepository } from '../../test-utils/in-memory-account.repository';
import { InMemoryAdminUserRepository } from '../../test-utils/in-memory-admin-user.repository';
import { CreateCompedAccountUseCase } from './create-comped-account.usecase';
import { ShowAccountUseCase } from './show-account.usecase';

const MISSING_ID = 'ffffffff-ffff-4fff-bfff-ffffffffffff';
const SHOP: Project = {
  id: 'b0b0b0b0-0000-4000-8000-000000000001',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'UTC',
  conversionEvent: null,
  createdAt: new Date('2026-10-14T10:00:00.000Z'),
};

function setup() {
  const admins = new InMemoryAdminUserRepository();
  const accounts = new InMemoryAccountRepository(admins);
  return {
    admins,
    accounts,
    createAccount: new CreateCompedAccountUseCase(admins, accounts),
    showAccount: new ShowAccountUseCase(accounts),
  };
}

describe('CreateCompedAccountUseCase', () => {
  it('creates a free account for an owner who is not an admin yet', async () => {
    const { admins, accounts, createAccount } = setup();

    const created = await createAccount.execute({ ownerEmail: ' Friend@Example.com ' });

    const owner = await admins.findByEmail('friend@example.com');
    expect(created).toEqual({
      accountId: expect.any(String) as string,
      ownerAdminId: owner?.id,
      ownerEmail: 'friend@example.com',
    });
    expect(accounts.stored).toEqual([
      expect.objectContaining({ id: created.accountId, ownerAdminId: owner?.id, status: 'comped' }),
    ]);
  });

  it('reuses the admin an owner already is', async () => {
    const { admins, createAccount } = setup();
    const existing = await admins.grantAccess('ana@example.com', SHOP.id);

    const created = await createAccount.execute({ ownerEmail: 'ana@example.com' });

    expect(created.ownerAdminId).toBe(existing.id);
  });
});

describe('ShowAccountUseCase', () => {
  it('shows the owner, the projects, the people and the plan limits', async () => {
    const { admins, accounts, showAccount } = setup();
    const owner = await admins.findOrCreateByEmail('owner@example.com');
    const account = await accounts.create({ ownerAdminId: owner.id, status: 'comped' });
    accounts.add(account, { projects: [SHOP], people: 2 });

    const summary = await showAccount.execute({ accountId: account.id });

    expect(summary).toEqual({
      account,
      ownerEmail: 'owner@example.com',
      projects: [SHOP],
      people: 2,
      limits: HOSTED_PLAN_LIMITS,
    });
  });

  it('shows an account without projects as empty', async () => {
    const { admins, accounts, showAccount } = setup();
    const owner = await admins.findOrCreateByEmail('owner@example.com');
    const account = await accounts.create({ ownerAdminId: owner.id, status: 'comped' });

    const summary = await showAccount.execute({ accountId: account.id });

    expect(summary).toMatchObject({ projects: [], people: 0 });
    expect(await accounts.projectsOf(account.id)).toEqual([]);
    expect(await accounts.peopleCount(account.id)).toBe(0);
  });

  it('refuses an account that does not exist', async () => {
    const { accounts, showAccount } = setup();

    await expect(showAccount.execute({ accountId: MISSING_ID })).rejects.toBeInstanceOf(
      AccountNotFoundError,
    );
    expect(await accounts.findById(MISSING_ID)).toBeNull();
    expect(await accounts.projectsOf(MISSING_ID)).toEqual([]);
    expect(await accounts.peopleCount(MISSING_ID)).toBe(0);
  });

  it('finds nothing for an account whose owner is not known', async () => {
    const { accounts } = setup();
    accounts.add({
      id: 'acc00000-0000-4000-a000-000000000009',
      ownerAdminId: MISSING_ID,
      status: 'comped',
      createdAt: new Date('2026-10-14T00:00:00.000Z'),
    });

    expect(await accounts.overviewOf('acc00000-0000-4000-a000-000000000009')).toBeNull();
    expect(await accounts.findById('acc00000-0000-4000-a000-000000000009')).not.toBeNull();
  });
});
