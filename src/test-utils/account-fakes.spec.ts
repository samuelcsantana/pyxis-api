import { InMemoryAccountRepository } from './in-memory-account.repository';
import { InMemoryAdminUserRepository } from './in-memory-admin-user.repository';

describe('InMemoryAccountRepository', () => {
  it("finds an owner's newest account that has not ended", async () => {
    const accounts = new InMemoryAccountRepository(new InMemoryAdminUserRepository());
    await accounts.create({ ownerAdminId: 'owner', status: 'ended' });

    expect(await accounts.liveAccountOwnedBy('owner')).toBeNull();

    await accounts.create({ ownerAdminId: 'owner', status: 'active' });
    const newest = await accounts.create({ ownerAdminId: 'owner', status: 'incomplete' });

    expect(await accounts.liveAccountOwnedBy('owner')).toEqual(newest);
  });

  it('lists the accounts an admin owns, then those they were added to', async () => {
    const accounts = new InMemoryAccountRepository(new InMemoryAdminUserRepository());
    const owned = await accounts.create({ ownerAdminId: 'ana', status: 'trialing' });
    const joined = await accounts.create({ ownerAdminId: 'bia', status: 'active' });
    accounts.addMember(joined, 'ana');

    expect(await accounts.membershipsOf('ana')).toEqual([
      { account: owned, role: 'owner' },
      { account: joined, role: 'member' },
    ]);
    expect(await accounts.membershipsOf('carla')).toEqual([]);
  });

  it('claims a free place like the database: an account that is no longer unfinished stays as it is', async () => {
    const accounts = new InMemoryAccountRepository(new InMemoryAdminUserRepository());
    const running = await accounts.create({ ownerAdminId: 'ana', status: 'active' });
    const claim = { ownerAdminId: 'ana', freeAccountsMax: 5, at: new Date('2026-11-02T00:00:00Z') };

    expect(await accounts.claimFreePlace({ ...claim, accountId: running.id })).toEqual({
      account: running,
      placement: 'place',
    });
    await expect(
      accounts.claimFreePlace({ ...claim, accountId: 'acc00000-0000-4000-a000-000000000404' }),
    ).rejects.toThrow('no longer exists');
  });

  describe('one free place per mailbox, like the database', () => {
    const AT = new Date('2026-11-02T00:00:00Z');
    const EARLIER = new Date('2026-11-01T00:00:00Z');

    async function aliases(): Promise<{
      readonly accounts: InMemoryAccountRepository;
      readonly plain: string;
      readonly tagged: string;
      readonly dotted: string;
    }> {
      const admins = new InMemoryAdminUserRepository();
      const plain = await admins.findOrCreateByEmail('anab@gmail.com');
      const tagged = await admins.findOrCreateByEmail('anab+shop@gmail.com');
      const dotted = await admins.findOrCreateByEmail('ana.b@googlemail.com');
      return {
        accounts: new InMemoryAccountRepository(admins),
        plain: plain.id,
        tagged: tagged.id,
        dotted: dotted.id,
      };
    }

    it('refuses a new account of a mailbox that already has one on the free plan', async () => {
      const { accounts, plain, tagged } = await aliases();
      await accounts.claimFreePlace({
        ownerAdminId: plain,
        accountId: null,
        freeAccountsMax: 5,
        at: AT,
      });

      const refused = await accounts.claimFreePlace({
        ownerAdminId: tagged,
        accountId: null,
        freeAccountsMax: 5,
        at: AT,
      });

      expect(refused.placement).toBe('refuse');
      expect(refused.account).toMatchObject({ status: 'incomplete', freeWaitlistedAt: null });
    });

    it('refuses an unfinished account of a mailbox that already waits for a place', async () => {
      const { accounts, plain, tagged } = await aliases();
      await accounts.create({ ownerAdminId: 'stranger', status: 'free' });
      await accounts.claimFreePlace({
        ownerAdminId: plain,
        accountId: null,
        freeAccountsMax: 1,
        at: AT,
      });
      const unfinished = await accounts.create({ ownerAdminId: tagged, status: 'incomplete' });

      const refused = await accounts.claimFreePlace({
        ownerAdminId: tagged,
        accountId: unfinished.id,
        freeAccountsMax: 1,
        at: AT,
      });

      expect(refused).toEqual({ account: unfinished, placement: 'refuse' });
    });

    it('opens one waiting account per mailbox, the one waiting longest, and none for a mailbox already on the plan', async () => {
      const { accounts, plain, tagged, dotted } = await aliases();
      const sooner = await accounts.create({ ownerAdminId: tagged, status: 'incomplete' });
      const later = await accounts.create({ ownerAdminId: dotted, status: 'incomplete' });
      accounts.add({ ...sooner, freeWaitlistedAt: EARLIER });
      accounts.add({ ...later, freeWaitlistedAt: AT });

      expect(await accounts.openWaitingAccounts(5, AT)).toBe(1);
      expect(await accounts.findById(sooner.id)).toMatchObject({ status: 'free' });
      expect(await accounts.findById(later.id)).toMatchObject({ status: 'incomplete' });

      const waiting = await accounts.create({ ownerAdminId: plain, status: 'incomplete' });
      accounts.add({ ...waiting, freeWaitlistedAt: AT });

      expect(await accounts.openWaitingAccounts(5, AT)).toBe(0);
    });
  });
});
