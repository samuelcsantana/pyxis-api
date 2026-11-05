import { Logger } from '@nestjs/common';
import type { AccountStatus } from '../../domain/accounts/account-status';
import { PlanRequiredError } from '../../domain/errors/account.errors';
import { ProjectNotFoundError } from '../../domain/errors/project.errors';
import {
  InvalidShareLinkError,
  ShareLinkLockedError,
  ShareLinkNotFoundError,
  SharePasswordNotSetError,
  WrongSharePasswordError,
} from '../../domain/errors/share-link.errors';
import {
  MAX_FAILED_UNLOCKS,
  SHARE_UNLOCK_LIFETIME_MS,
  SHARE_UNLOCK_PATTERN,
  UNLOCK_FAILURE_WINDOW_MS,
} from '../../domain/share-links/share-unlock';
import { FakePasswordHasher } from '../../test-utils/fake-password-hasher';
import { FixedClock } from '../../test-utils/fixed-clock';
import { InMemoryAccountRepository } from '../../test-utils/in-memory-account.repository';
import { InMemoryAdminUserRepository } from '../../test-utils/in-memory-admin-user.repository';
import { InMemoryGoalRepository } from '../../test-utils/in-memory-goal.repository';
import { InMemoryProjectRepository } from '../../test-utils/in-memory-project.repository';
import {
  InMemoryShareLinkRepository,
  InMemoryShareUnlockRepository,
  shareLinkIdOf,
} from '../../test-utils/in-memory-share-link.repository';
import { SequenceRandomSource } from '../../test-utils/sequence-random-source';
import { CreateProjectUseCase } from '../projects/create-project.usecase';
import { CreateShareLinkUseCase } from './create-share-link.usecase';
import { OpenShareLinkUseCase } from './open-share-link.usecase';
import { RevokeShareLinkUseCase } from './revoke-share-link.usecase';
import { SetShareLinkPasswordUseCase } from './set-share-link-password.usecase';
import { UnlockShareLinkUseCase } from './unlock-share-link.usecase';

const OWNER_ID = 'ad000000-0000-4000-a000-000000000001';
const MEMBER_ID = 'ad000000-0000-4000-a000-000000000002';
const NOW = new Date('2026-11-05T12:00:00.000Z');
const PASSWORD = 'correct horse';
const MINUTE_MS = 60_000;

function randomSource() {
  return new SequenceRandomSource(Array.from({ length: 62 }, (_, index) => index));
}

async function setup(password: string | null = PASSWORD) {
  const store = new InMemoryProjectRepository();
  const accounts = new InMemoryAccountRepository(new InMemoryAdminUserRepository());
  const account = await accounts.create({ ownerAdminId: OWNER_ID, status: 'active' });
  store.addAccount(account.id, OWNER_ID);
  const { projectId } = await new CreateProjectUseCase(store, randomSource(), accounts).execute({
    name: 'Shop',
    allowedOrigins: ['https://shop.example.com'],
    accountId: account.id,
  });
  const unlocks = new InMemoryShareUnlockRepository();
  const links = new InMemoryShareLinkRepository(unlocks);
  const hasher = new FakePasswordHasher();
  const clock = new FixedClock(NOW);
  const createLink = new CreateShareLinkUseCase(
    store,
    accounts,
    links,
    randomSource(),
    hasher,
    clock,
  );
  const open = new OpenShareLinkUseCase(
    links,
    store,
    accounts,
    new InMemoryGoalRepository(),
    unlocks,
    clock,
  );
  const create = (name: string, withPassword: string | null) =>
    createLink.execute({
      adminUserId: OWNER_ID,
      projectId,
      name,
      expiresAt: null,
      password: withPassword,
    });
  const { link, token } = await create('Board', password);
  return {
    accounts,
    account,
    projectId,
    links,
    unlocks,
    clock,
    link,
    token,
    create,
    open,
    unlock: new UnlockShareLinkUseCase(open, links, unlocks, hasher, randomSource(), clock),
    setPassword: new SetShareLinkPasswordUseCase(store, accounts, links, hasher),
    revoke: new RevokeShareLinkUseCase(store, accounts, links),
  };
}

describe('a share link with a password', () => {
  let logs: unknown[];
  let warnings: unknown[];

  beforeEach(() => {
    logs = [];
    warnings = [];
    jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      logs.push(message);
    });
    jest.spyOn(Logger.prototype, 'warn').mockImplementation((message: unknown) => {
      warnings.push(message);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('is created protected, with only the hash of its password kept', async () => {
    const { link, links } = await setup();

    expect(link.passwordProtected).toBe(true);
    await expect(links.passwordHashOf(link.id)).resolves.toBe(`fake-hash:${PASSWORD}`);
  });

  it('opens locked by its token alone, and unlocked with a live unlock of that link', async () => {
    const { open, unlock, token } = await setup();

    const locked = await open.execute(token);
    const { unlock: proof, expiresAt } = await unlock.execute(token, PASSWORD);

    expect(locked.unlocked).toBe(false);
    expect(proof).toMatch(SHARE_UNLOCK_PATTERN);
    expect(expiresAt).toEqual(new Date(NOW.getTime() + SHARE_UNLOCK_LIFETIME_MS));
    await expect(open.execute(token, proof)).resolves.toMatchObject({ unlocked: true });
    expect(logs).toContainEqual({ message: 'share_link.unlocked', shareLinkId: shareLinkIdOf(1) });
    expect(JSON.stringify(logs)).not.toContain(PASSWORD);
  });

  it('stays locked for an unlock of another link, or one that expired', async () => {
    const { open, unlock, create, clock, token } = await setup();
    const other = await create('Other', 'another secret');
    const otherProof = (await unlock.execute(other.token, 'another secret')).unlock;
    const proof = (await unlock.execute(token, PASSWORD)).unlock;

    await expect(open.execute(token, otherProof)).resolves.toMatchObject({ unlocked: false });
    clock.advanceBy(SHARE_UNLOCK_LIFETIME_MS - 1);
    await expect(open.execute(token, proof)).resolves.toMatchObject({ unlocked: true });
    clock.advanceBy(1);
    await expect(open.execute(token, proof)).resolves.toMatchObject({ unlocked: false });
  });

  it('opens a link without a password by its token alone', async () => {
    const { open, token } = await setup(null);

    await expect(open.execute(token)).resolves.toMatchObject({ unlocked: true });
  });

  it('refuses a wrong password, counts it for that link only, and logs only the link', async () => {
    const { unlock, links, link, create, token } = await setup();
    const other = await create('Other', 'another secret');

    await expect(unlock.execute(token, 'wrong horse')).rejects.toBeInstanceOf(
      WrongSharePasswordError,
    );

    await expect(links.unlockFailuresOf(link.id)).resolves.toEqual({ count: 1, since: NOW });
    await expect(links.unlockFailuresOf(other.link.id)).resolves.toEqual({
      count: 0,
      since: null,
    });
    expect(warnings).toEqual([{ message: 'share_link.unlock_failed', shareLinkId: link.id }]);
  });

  it(`locks the link after ${String(MAX_FAILED_UNLOCKS)} wrong passwords, the right one too, until the window ends`, async () => {
    const { unlock, clock, token } = await setup();
    for (let attempt = 1; attempt < MAX_FAILED_UNLOCKS; attempt += 1) {
      await expect(unlock.execute(token, 'wrong horse')).rejects.toBeInstanceOf(
        WrongSharePasswordError,
      );
    }
    clock.advanceBy(5 * MINUTE_MS);
    await expect(unlock.execute(token, PASSWORD)).resolves.toMatchObject({});
    await expect(unlock.execute(token, 'wrong horse')).rejects.toBeInstanceOf(
      WrongSharePasswordError,
    );

    const locked = unlock.execute(token, PASSWORD);

    await expect(locked).rejects.toBeInstanceOf(ShareLinkLockedError);
    await expect(locked).rejects.toMatchObject({ code: 'rate_limited', retryAfterSeconds: 600 });
    clock.advanceBy(UNLOCK_FAILURE_WINDOW_MS - 5 * MINUTE_MS);
    await expect(unlock.execute(token, PASSWORD)).resolves.toMatchObject({});
  });

  it('starts counting again once the window of the first failure is over', async () => {
    const { unlock, links, link, clock, token } = await setup();
    await expect(unlock.execute(token, 'wrong horse')).rejects.toBeInstanceOf(
      WrongSharePasswordError,
    );
    clock.advanceBy(UNLOCK_FAILURE_WINDOW_MS);

    await expect(unlock.execute(token, 'wrong horse')).rejects.toBeInstanceOf(
      WrongSharePasswordError,
    );

    await expect(links.unlockFailuresOf(link.id)).resolves.toEqual({
      count: 1,
      since: new Date(NOW.getTime() + UNLOCK_FAILURE_WINDOW_MS),
    });
  });

  it('answers share_password_not_set for a link without a password', async () => {
    const { unlock, token } = await setup(null);

    await expect(unlock.execute(token, PASSWORD)).rejects.toBeInstanceOf(SharePasswordNotSetError);
  });

  it('answers share_link_not_found for a closed link, even with the right password', async () => {
    const { unlock, accounts, account, token } = await setup();
    accounts.add({ ...account, status: 'free' });

    await expect(unlock.execute(token, PASSWORD)).rejects.toBeInstanceOf(ShareLinkNotFoundError);
  });

  it('stops every unlock when the link is revoked', async () => {
    const { unlock, revoke, unlocks, projectId, link, token } = await setup();
    await unlock.execute(token, PASSWORD);

    await revoke.execute({ adminUserId: OWNER_ID, projectId, linkId: link.id });

    expect(unlocks.stored).toEqual([]);
  });
});

describe('SetShareLinkPasswordUseCase', () => {
  let logs: unknown[];

  beforeEach(() => {
    logs = [];
    jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      logs.push(message);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('changes the password, which stops the open unlocks and the old password', async () => {
    const { setPassword, unlock, open, links, projectId, link, token } = await setup();
    const proof = (await unlock.execute(token, PASSWORD)).unlock;

    const changed = await setPassword.execute({
      adminUserId: OWNER_ID,
      projectId,
      linkId: link.id,
      password: 'battery staple',
    });

    expect(changed.passwordProtected).toBe(true);
    await expect(links.passwordHashOf(link.id)).resolves.toBe('fake-hash:battery staple');
    await expect(open.execute(token, proof)).resolves.toMatchObject({ unlocked: false });
    await expect(unlock.execute(token, PASSWORD)).rejects.toBeInstanceOf(WrongSharePasswordError);
    expect(logs).toContainEqual({
      message: 'share_link.password_changed',
      projectId,
      shareLinkId: link.id,
      passwordProtected: true,
    });
    expect(JSON.stringify(logs)).not.toContain('battery staple');
  });

  it('removes the password, so the token alone opens the reports again', async () => {
    const { setPassword, open, projectId, link, token } = await setup();

    const changed = await setPassword.execute({
      adminUserId: OWNER_ID,
      projectId,
      linkId: link.id,
      password: null,
    });

    expect(changed.passwordProtected).toBe(false);
    await expect(open.execute(token)).resolves.toMatchObject({ unlocked: true });
  });

  it('changes that link only', async () => {
    const { setPassword, create, links, projectId, link } = await setup();
    const other = await create('Other', 'another secret');

    await setPassword.execute({
      adminUserId: OWNER_ID,
      projectId,
      linkId: link.id,
      password: null,
    });

    await expect(links.passwordHashOf(other.link.id)).resolves.toBe('fake-hash:another secret');
    await expect(links.unlockFailuresOf(shareLinkIdOf(9))).resolves.toEqual({
      count: 0,
      since: null,
    });
  });

  it('forgets the wrong passwords counted so far', async () => {
    const { setPassword, unlock, links, projectId, link, token } = await setup();
    await expect(unlock.execute(token, 'wrong horse')).rejects.toBeInstanceOf(
      WrongSharePasswordError,
    );

    await setPassword.execute({
      adminUserId: OWNER_ID,
      projectId,
      linkId: link.id,
      password: null,
    });

    await expect(links.unlockFailuresOf(link.id)).resolves.toEqual({ count: 0, since: null });
  });

  it.each(['free', 'ended'] as const satisfies readonly AccountStatus[])(
    'refuses an account in %s',
    async (status) => {
      const { setPassword, accounts, account, projectId, link } = await setup();
      accounts.add({ ...account, status });

      await expect(
        setPassword.execute({ adminUserId: OWNER_ID, projectId, linkId: link.id, password: null }),
      ).rejects.toBeInstanceOf(Error);
    },
  );

  it('refuses the free plan with plan_required', async () => {
    const { setPassword, accounts, account, projectId, link } = await setup();
    accounts.add({ ...account, status: 'free' });

    await expect(
      setPassword.execute({ adminUserId: OWNER_ID, projectId, linkId: link.id, password: null }),
    ).rejects.toBeInstanceOf(PlanRequiredError);
  });

  it('refuses a person who does not own the account, and a link of no such id', async () => {
    const { setPassword, projectId, link } = await setup();

    await expect(
      setPassword.execute({ adminUserId: MEMBER_ID, projectId, linkId: link.id, password: null }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
    await expect(
      setPassword.execute({
        adminUserId: OWNER_ID,
        projectId,
        linkId: shareLinkIdOf(9),
        password: null,
      }),
    ).rejects.toBeInstanceOf(ShareLinkNotFoundError);
  });

  it('refuses a password too short before touching the store', async () => {
    const { setPassword, links, projectId, link } = await setup();

    await expect(
      setPassword.execute({ adminUserId: OWNER_ID, projectId, linkId: link.id, password: 'short' }),
    ).rejects.toBeInstanceOf(InvalidShareLinkError);
    await expect(links.passwordHashOf(link.id)).resolves.toBe(`fake-hash:${PASSWORD}`);
  });
});
