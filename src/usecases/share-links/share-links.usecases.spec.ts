import type { AccountStatus } from '../../domain/accounts/account-status';
import { sha256Hex } from '../../domain/auth/hashing';
import {
  AccountSuspendedError,
  PlanRequiredError,
  SubscriptionRequiredError,
} from '../../domain/errors/account.errors';
import { ProjectNotFoundError } from '../../domain/errors/project.errors';
import {
  InvalidShareLinkError,
  ShareLinkLimitReachedError,
  ShareLinkNotFoundError,
} from '../../domain/errors/share-link.errors';
import {
  MAX_SHARE_LINKS_PER_PROJECT,
  SHARE_TOKEN_PATTERN,
} from '../../domain/share-links/share-link';
import { FixedClock } from '../../test-utils/fixed-clock';
import { InMemoryAccountRepository } from '../../test-utils/in-memory-account.repository';
import { InMemoryAdminUserRepository } from '../../test-utils/in-memory-admin-user.repository';
import { InMemoryGoalRepository } from '../../test-utils/in-memory-goal.repository';
import { InMemoryProjectRepository } from '../../test-utils/in-memory-project.repository';
import { FakePasswordHasher } from '../../test-utils/fake-password-hasher';
import {
  InMemoryShareLinkRepository,
  InMemoryShareUnlockRepository,
  shareLinkIdOf,
} from '../../test-utils/in-memory-share-link.repository';
import { SequenceRandomSource } from '../../test-utils/sequence-random-source';
import { CreateProjectUseCase } from '../projects/create-project.usecase';
import { CreateShareLinkUseCase } from './create-share-link.usecase';
import { ListShareLinksUseCase } from './list-share-links.usecase';
import { OpenShareLinkUseCase } from './open-share-link.usecase';
import { RevokeShareLinkUseCase } from './revoke-share-link.usecase';

const OWNER_ID = 'ad000000-0000-4000-a000-000000000001';
const MEMBER_ID = 'ad000000-0000-4000-a000-000000000002';
const NOW = new Date('2026-11-05T12:00:00.000Z');
const TOMORROW = new Date('2026-11-06T12:00:00.000Z');
const ONE_DAY_MS = 86_400_000;
const ALPHABET_SIZE = 62;
const SIGNUP = { type: 'event', name: 'signup_completed' } as const;

function randomSource() {
  return new SequenceRandomSource(Array.from({ length: ALPHABET_SIZE }, (_, index) => index));
}

async function setup(status: AccountStatus = 'active') {
  const store = new InMemoryProjectRepository();
  const accounts = new InMemoryAccountRepository(new InMemoryAdminUserRepository());
  const account = await accounts.create({ ownerAdminId: OWNER_ID, status });
  store.addAccount(account.id, OWNER_ID);
  const { projectId } = await new CreateProjectUseCase(store, randomSource(), accounts).execute({
    name: 'Shop',
    allowedOrigins: ['https://shop.example.com'],
    accountId: account.id,
  });
  const unlocks = new InMemoryShareUnlockRepository();
  const links = new InMemoryShareLinkRepository(unlocks);
  const goals = new InMemoryGoalRepository();
  await goals.create(projectId, { name: 'Signed up', target: SIGNUP }, 1);
  const clock = new FixedClock(NOW);
  return {
    store,
    accounts,
    account,
    projectId,
    links,
    unlocks,
    goals,
    clock,
    createLink: new CreateShareLinkUseCase(
      store,
      accounts,
      links,
      randomSource(),
      new FakePasswordHasher(),
      clock,
    ),
    listLinks: new ListShareLinksUseCase(store, accounts, links),
    revokeLink: new RevokeShareLinkUseCase(store, accounts, links),
    openLink: new OpenShareLinkUseCase(links, store, accounts, goals, unlocks, clock),
  };
}

describe('CreateShareLinkUseCase', () => {
  it('answers the token once and keeps only its hash, with the name trimmed', async () => {
    const { createLink, links, projectId } = await setup();

    const created = await createLink.execute({
      adminUserId: OWNER_ID,
      projectId,
      name: '  For the agency ',
      expiresAt: TOMORROW,
      password: null,
    });

    expect(created.token).toMatch(SHARE_TOKEN_PATTERN);
    expect(created.link).toEqual({
      id: shareLinkIdOf(1),
      projectId,
      name: 'For the agency',
      createdAt: NOW,
      expiresAt: TOMORROW,
      passwordProtected: false,
    });
    expect(links.tokenHashes).toEqual([sha256Hex(created.token)]);
  });

  it('creates a link that never expires', async () => {
    const { createLink, projectId } = await setup();

    const created = await createLink.execute({
      adminUserId: OWNER_ID,
      projectId,
      name: 'Board',
      expiresAt: null,
      password: null,
    });

    expect(created.link.expiresAt).toBeNull();
  });

  it.each(['trialing', 'past_due', 'ending', 'comped'] as const)(
    'lets an account in %s share, as every Pro status',
    async (status) => {
      const { createLink, projectId } = await setup(status);

      await expect(
        createLink.execute({
          adminUserId: OWNER_ID,
          projectId,
          name: 'Board',
          expiresAt: null,
          password: null,
        }),
      ).resolves.toMatchObject({ link: { name: 'Board' } });
    },
  );

  it('refuses a free account with plan_required, storing nothing', async () => {
    const { createLink, links, projectId } = await setup('free');

    await expect(
      createLink.execute({
        adminUserId: OWNER_ID,
        projectId,
        name: 'Board',
        expiresAt: null,
        password: null,
      }),
    ).rejects.toMatchObject({ code: 'plan_required', feature: 'public_share_link' });
    await expect(
      createLink.execute({
        adminUserId: OWNER_ID,
        projectId,
        name: 'Board',
        expiresAt: null,
        password: null,
      }),
    ).rejects.toBeInstanceOf(PlanRequiredError);
    expect(links.stored).toEqual([]);
  });

  it('refuses an account without access before the plan', async () => {
    const { createLink, projectId } = await setup('ended');

    await expect(
      createLink.execute({
        adminUserId: OWNER_ID,
        projectId,
        name: 'Board',
        expiresAt: null,
        password: null,
      }),
    ).rejects.toBeInstanceOf(SubscriptionRequiredError);
  });

  it('refuses a person who does not own the account as an unknown project', async () => {
    const { createLink, projectId } = await setup();

    await expect(
      createLink.execute({
        adminUserId: MEMBER_ID,
        projectId,
        name: 'Board',
        expiresAt: null,
        password: null,
      }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });

  it(`refuses link ${String(MAX_SHARE_LINKS_PER_PROJECT + 1)} with share_link_limit_reached`, async () => {
    const { createLink, projectId } = await setup();
    for (let index = 0; index < MAX_SHARE_LINKS_PER_PROJECT; index += 1) {
      await createLink.execute({
        adminUserId: OWNER_ID,
        projectId,
        name: `Link ${String(index)}`,
        expiresAt: null,
        password: null,
      });
    }

    await expect(
      createLink.execute({
        adminUserId: OWNER_ID,
        projectId,
        name: 'One more',
        expiresAt: null,
        password: null,
      }),
    ).rejects.toBeInstanceOf(ShareLinkLimitReachedError);
  });

  it.each([
    ['an empty name', '  ', null, null, 'name'],
    ['a name too long', 'x'.repeat(65), null, null, 'name'],
    ['an expiry in the past', 'Board', new Date(NOW.getTime() - ONE_DAY_MS), null, 'expires_at'],
    ['an expiry right now', 'Board', NOW, null, 'expires_at'],
    ['a password of seven characters', 'Board', null, 'x'.repeat(7), 'password'],
    ['a password of 129 characters', 'Board', null, 'x'.repeat(129), 'password'],
  ])('refuses %s before touching the store', async (_case, name, expiresAt, password, field) => {
    const { createLink, links, projectId } = await setup();

    const refusal = createLink.execute({
      adminUserId: OWNER_ID,
      projectId,
      name,
      expiresAt,
      password,
    });

    await expect(refusal).rejects.toBeInstanceOf(InvalidShareLinkError);
    await expect(refusal).rejects.toMatchObject({ field });
    expect(links.stored).toEqual([]);
  });
});

describe('ListShareLinksUseCase', () => {
  it('lists the links of the project, without their tokens', async () => {
    const { createLink, listLinks, projectId } = await setup();
    await createLink.execute({
      adminUserId: OWNER_ID,
      projectId,
      name: 'Board',
      expiresAt: null,
      password: null,
    });

    await expect(listLinks.execute({ adminUserId: OWNER_ID, projectId })).resolves.toEqual([
      {
        id: shareLinkIdOf(1),
        projectId,
        name: 'Board',
        createdAt: NOW,
        expiresAt: null,
        passwordProtected: false,
      },
    ]);
  });

  it('still lists them for an account that left Pro, so the owner can revoke them', async () => {
    const { createLink, listLinks, accounts, account, projectId } = await setup();
    await createLink.execute({
      adminUserId: OWNER_ID,
      projectId,
      name: 'Board',
      expiresAt: null,
      password: null,
    });
    accounts.add({ ...account, status: 'free' });

    await expect(listLinks.execute({ adminUserId: OWNER_ID, projectId })).resolves.toHaveLength(1);
  });

  it('refuses a person who does not own the account as an unknown project', async () => {
    const { listLinks, projectId } = await setup();

    await expect(listLinks.execute({ adminUserId: MEMBER_ID, projectId })).rejects.toBeInstanceOf(
      ProjectNotFoundError,
    );
  });
});

describe('RevokeShareLinkUseCase', () => {
  it('deletes the link, so its token stops opening at once', async () => {
    const { createLink, revokeLink, openLink, links, projectId } = await setup();
    const { link, token } = await createLink.execute({
      adminUserId: OWNER_ID,
      projectId,
      name: 'Board',
      expiresAt: null,
      password: null,
    });

    await revokeLink.execute({ adminUserId: OWNER_ID, projectId, linkId: link.id });

    expect(links.stored).toEqual([]);
    await expect(openLink.execute(token)).rejects.toBeInstanceOf(ShareLinkNotFoundError);
  });

  it('answers share_link_not_found for an id the project does not have', async () => {
    const { revokeLink, projectId } = await setup();

    await expect(
      revokeLink.execute({ adminUserId: OWNER_ID, projectId, linkId: shareLinkIdOf(9) }),
    ).rejects.toBeInstanceOf(ShareLinkNotFoundError);
  });

  it('refuses a person who does not own the account as an unknown project', async () => {
    const { revokeLink, projectId } = await setup();

    await expect(
      revokeLink.execute({ adminUserId: MEMBER_ID, projectId, linkId: shareLinkIdOf(1) }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });
});

describe('OpenShareLinkUseCase', () => {
  async function shared(status: AccountStatus = 'active', expiresAt: Date | null = null) {
    const context = await setup();
    const { token } = await context.createLink.execute({
      adminUserId: OWNER_ID,
      projectId: context.projectId,
      name: 'Board',
      expiresAt,
      password: null,
    });
    context.accounts.add({ ...context.account, status });
    return { ...context, token };
  }

  it('opens the project and its goals for a live token', async () => {
    const { openLink, token, projectId } = await shared();

    const opened = await openLink.execute(token);

    expect(opened.project.id).toBe(projectId);
    expect(opened.link.name).toBe('Board');
    expect(opened.goals.map((goal) => goal.name)).toEqual(['Signed up']);
  });

  it('opens until the instant the link expires, and never after', async () => {
    const { openLink, token, clock } = await shared('active', TOMORROW);
    clock.advanceBy(ONE_DAY_MS - 1);
    await expect(openLink.execute(token)).resolves.toMatchObject({ link: { name: 'Board' } });

    clock.advanceBy(1);

    await expect(openLink.execute(token)).rejects.toBeInstanceOf(ShareLinkNotFoundError);
  });

  it.each([
    ['a token of another shape', 'pyxis_sk_abc'],
    ['a token of the right shape that was never issued', `pyxis_sh_${'A'.repeat(32)}`],
  ])('answers share_link_not_found for %s', async (_case, token) => {
    const { openLink } = await shared();

    await expect(openLink.execute(token)).rejects.toBeInstanceOf(ShareLinkNotFoundError);
  });

  it.each(['free', 'ended', 'incomplete'] as const)(
    'answers share_link_not_found once the account is %s, keeping the link',
    async (status) => {
      const { openLink, token, links } = await shared(status);

      await expect(openLink.execute(token)).rejects.toBeInstanceOf(ShareLinkNotFoundError);
      expect(links.stored).toHaveLength(1);
    },
  );

  it('opens again when the account comes back to Pro', async () => {
    const { openLink, token, accounts, account } = await shared('free');
    accounts.add({ ...account, status: 'active' });

    await expect(openLink.execute(token)).resolves.toMatchObject({ link: { name: 'Board' } });
  });

  it('answers share_link_not_found for a suspended account, never account_suspended', async () => {
    const { openLink, token, accounts, account } = await shared();
    await accounts.suspend(account.id, 'abuse', NOW);

    const refusal = openLink.execute(token);

    await expect(refusal).rejects.toBeInstanceOf(ShareLinkNotFoundError);
    await expect(refusal).rejects.not.toBeInstanceOf(AccountSuspendedError);
  });

  it('answers share_link_not_found when the account of the project is gone', async () => {
    const { links, store, goals, clock, token } = await shared();
    const noAccounts = new InMemoryAccountRepository(new InMemoryAdminUserRepository());

    await expect(
      new OpenShareLinkUseCase(
        links,
        store,
        noAccounts,
        goals,
        new InMemoryShareUnlockRepository(),
        clock,
      ).execute(token),
    ).rejects.toBeInstanceOf(ShareLinkNotFoundError);
  });

  it('answers share_link_not_found when the project is gone', async () => {
    const { links, accounts, goals, clock, token } = await shared();

    await expect(
      new OpenShareLinkUseCase(
        links,
        new InMemoryProjectRepository(),
        accounts,
        goals,
        new InMemoryShareUnlockRepository(),
        clock,
      ).execute(token),
    ).rejects.toBeInstanceOf(ShareLinkNotFoundError);
  });

  it("opens a link of the operator's own project, which has no account", async () => {
    const store = new InMemoryProjectRepository();
    const accounts = new InMemoryAccountRepository(new InMemoryAdminUserRepository());
    const { projectId } = await new CreateProjectUseCase(store, randomSource(), accounts).execute({
      name: 'Operator site',
      allowedOrigins: ['https://operator.example.com'],
    });
    const links = new InMemoryShareLinkRepository();
    const token = `pyxis_sh_${'B'.repeat(32)}`;
    await links.create(
      {
        projectId,
        name: 'Public',
        tokenHash: sha256Hex(token),
        passwordHash: null,
        createdAt: NOW,
        expiresAt: null,
      },
      MAX_SHARE_LINKS_PER_PROJECT,
    );
    const openLink = new OpenShareLinkUseCase(
      links,
      store,
      accounts,
      new InMemoryGoalRepository(),
      new InMemoryShareUnlockRepository(),
      new FixedClock(NOW),
    );

    await expect(openLink.execute(token)).resolves.toMatchObject({
      project: { id: projectId },
      goals: [],
    });
  });
});
