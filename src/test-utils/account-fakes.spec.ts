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
});
