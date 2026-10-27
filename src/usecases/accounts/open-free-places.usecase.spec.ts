import { Logger } from '@nestjs/common';
import type { Account } from '../../domain/entities/account.entity';
import { InMemoryAccountRepository } from '../../test-utils/in-memory-account.repository';
import { InMemoryAdminUserRepository } from '../../test-utils/in-memory-admin-user.repository';
import { OpenFreePlacesUseCase } from './open-free-places.usecase';

const FIRST = new Date('2026-11-18T09:00:00.000Z');
const SECOND = new Date('2026-11-19T09:00:00.000Z');
const THIRD = new Date('2026-11-20T09:00:00.000Z');
const OPENED_AT = new Date('2026-11-21T06:00:00.000Z');

async function waiting(accounts: InMemoryAccountRepository, owner: string, since: Date) {
  const account = await accounts.create({ ownerAdminId: owner, status: 'incomplete' });
  accounts.add({ ...account, freeWaitlistedAt: since });
}

function statusOf(
  accounts: InMemoryAccountRepository,
  owner: string,
): Account['status'] | undefined {
  return accounts.stored.find((account) => account.ownerAdminId === owner)?.status;
}

describe('OpenFreePlacesUseCase', () => {
  let log: jest.SpyInstance;

  beforeEach(() => {
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('opens the places left to the accounts that have waited longest, and logs how many', async () => {
    const accounts = new InMemoryAccountRepository(new InMemoryAdminUserRepository());
    await accounts.create({ ownerAdminId: 'already-free', status: 'free' });
    await waiting(accounts, 'third', THIRD);
    await waiting(accounts, 'first', FIRST);
    await waiting(accounts, 'second', SECOND);

    const opened = await new OpenFreePlacesUseCase(accounts, {
      freePlanOpen: true,
      freeAccountsMax: 3,
    }).execute(OPENED_AT);

    expect(opened).toBe(2);
    expect(statusOf(accounts, 'first')).toBe('free');
    expect(statusOf(accounts, 'second')).toBe('free');
    expect(statusOf(accounts, 'third')).toBe('incomplete');
    expect([...accounts.freeSince.values()]).toEqual([OPENED_AT, OPENED_AT]);
    expect(log).toHaveBeenCalledWith({ message: 'accounts.free_places_opened', opened: 2 });
  });

  it('opens nothing and logs nothing while the plan is full', async () => {
    const accounts = new InMemoryAccountRepository(new InMemoryAdminUserRepository());
    await accounts.create({ ownerAdminId: 'already-free', status: 'free' });
    await waiting(accounts, 'first', FIRST);

    const opened = await new OpenFreePlacesUseCase(accounts, {
      freePlanOpen: true,
      freeAccountsMax: 1,
    }).execute(OPENED_AT);

    expect(opened).toBe(0);
    expect(statusOf(accounts, 'first')).toBe('incomplete');
    expect(log).not.toHaveBeenCalled();
  });

  it('opens nothing while the free plan switch is off, whatever the places', async () => {
    const accounts = new InMemoryAccountRepository(new InMemoryAdminUserRepository());
    await waiting(accounts, 'first', FIRST);

    const opened = await new OpenFreePlacesUseCase(accounts, {
      freePlanOpen: false,
      freeAccountsMax: 200,
    }).execute(OPENED_AT);

    expect(opened).toBe(0);
    expect(statusOf(accounts, 'first')).toBe('incomplete');
  });

  it('skips a waiting account whose deletion is held or that is suspended', async () => {
    const accounts = new InMemoryAccountRepository(new InMemoryAdminUserRepository());
    await waiting(accounts, 'held', FIRST);
    await waiting(accounts, 'suspended', SECOND);
    const [held, suspended] = accounts.stored;
    if (held === undefined || suspended === undefined) {
      throw new Error('the two waiting accounts exist');
    }
    await accounts.hold(held.id, 'Court order', THIRD);
    await accounts.suspend(suspended.id, 'Abuse', THIRD);

    const opened = await new OpenFreePlacesUseCase(accounts, {
      freePlanOpen: true,
      freeAccountsMax: 5,
    }).execute(OPENED_AT);

    expect(opened).toBe(0);
  });
});
