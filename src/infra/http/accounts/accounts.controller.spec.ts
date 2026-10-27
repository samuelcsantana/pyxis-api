import type {
  WithdrawToFreePlanCommand,
  WithdrawToFreePlanUseCase,
} from '../../../usecases/accounts/withdraw-to-free-plan.usecase';
import type { FastifyRequest } from 'fastify';
import { HOSTED_PLAN_LIMITS } from '../../../domain/accounts/hosted-plan';
import type { Account } from '../../../domain/entities/account.entity';
import type { AdminUser } from '../../../domain/entities/admin-user.entity';
import type {
  CloseAccountCommand,
  CloseAccountUseCase,
} from '../../../usecases/accounts/close-account.usecase';
import type {
  ListMyAccountsUseCase,
  MyAccount,
} from '../../../usecases/accounts/list-my-accounts.usecase';
import type {
  OpenBillingPortalCommand,
  OpenBillingPortalUseCase,
} from '../../../usecases/accounts/open-billing-portal.usecase';
import type {
  StartCheckoutCommand,
  StartCheckoutUseCase,
} from '../../../usecases/accounts/start-checkout.usecase';
import { AccountsController, myAccountBody } from './accounts.controller';

const ADMIN: AdminUser = {
  id: '00000000-0000-4000-a000-000000000001',
  email: 'founder@example.com',
  emailLanguage: 'en',
  suspendedAt: null,
  createdAt: new Date('2026-11-01T00:00:00.000Z'),
};
const ACCOUNT: Account = {
  id: 'acc00000-0000-4000-a000-000000000001',
  ownerAdminId: ADMIN.id,
  status: 'trialing',
  ingestionPausedUntil: new Date('2026-12-01T00:00:00.000Z'),
  stripeCustomerId: 'cus_1',
  billingInterval: 'year',
  trialEndsAt: new Date('2026-11-15T00:00:00.000Z'),
  currentPeriodEndsAt: new Date('2026-11-15T00:00:00.000Z'),
  accessEndsAt: new Date('2027-11-15T00:00:00.000Z'),
  suspendedAt: null,
  suspensionReason: null,
  deletionHeldAt: null,
  deletionHoldReason: null,
  quotaPauseExemptUntil: null,
  freeWaitlistedAt: null,
  freePlanFitDueAt: null,
  eventsPerMonthLimit: null,
  projectsLimit: null,
  peopleLimit: null,
  createdAt: new Date('2026-11-01T00:00:00.000Z'),
};
const MEASURED_AT = new Date('2026-11-02T03:00:00.000Z');

function signedIn(): FastifyRequest {
  return { admin: ADMIN } as unknown as FastifyRequest;
}

function accountsController(accounts: readonly MyAccount[] = []) {
  const checkouts: StartCheckoutCommand[] = [];
  const portals: OpenBillingPortalCommand[] = [];
  const closures: CloseAccountCommand[] = [];
  const withdrawals: WithdrawToFreePlanCommand[] = [];
  const controller = new AccountsController(
    { execute: () => Promise.resolve(accounts) } as unknown as ListMyAccountsUseCase,
    {
      execute: (command: StartCheckoutCommand) => {
        checkouts.push(command);
        return Promise.resolve({ url: 'https://checkout.example.com/1' });
      },
    } as unknown as StartCheckoutUseCase,
    {
      execute: (command: OpenBillingPortalCommand) => {
        portals.push(command);
        return Promise.resolve({ url: 'https://portal.example.com/1' });
      },
    } as unknown as OpenBillingPortalUseCase,
    {
      execute: (command: CloseAccountCommand) => {
        closures.push(command);
        return Promise.resolve({
          accessEndsAt: new Date('2026-11-20T15:00:00.000Z'),
          deletionOn: new Date('2026-12-20T15:00:00.000Z'),
          refundedAmount: 3900,
        });
      },
    } as unknown as CloseAccountUseCase,
    {
      execute: (command: WithdrawToFreePlanCommand) => {
        withdrawals.push(command);
        return Promise.resolve({
          refundedAmount: 3900,
          fitBy: new Date('2026-12-20T15:00:00.000Z'),
        });
      },
    } as unknown as WithdrawToFreePlanUseCase,
  );
  return { controller, checkouts, portals, closures, withdrawals };
}

describe('myAccountBody', () => {
  it('shows the owner the billing dates, the month measured and the limits', () => {
    expect(
      myAccountBody({
        account: ACCOUNT,
        role: 'owner',
        month: '2026-11',
        usage: { month: '2026-11', events: 4200, updatedAt: MEASURED_AT },
        limits: HOSTED_PLAN_LIMITS,
        pauseAtEvents: 150_000,
        held: { projects: 2, people: 1 },
      }),
    ).toEqual({
      id: ACCOUNT.id,
      role: 'owner',
      status: 'trialing',
      billing_interval: 'year',
      trial_ends_at: '2026-11-15T00:00:00.000Z',
      current_period_ends_at: '2026-11-15T00:00:00.000Z',
      access_ends_at: '2027-11-15T00:00:00.000Z',
      ingestion_paused_until: '2026-12-01T00:00:00.000Z',
      quota_pause_exempt_until: null,
      free_waitlisted_at: null,
      suspended_at: null,
      suspension_reason: null,
      deletion_held_at: null,
      free_plan_fit_due_at: null,
      project_count: 2,
      people_count: 1,
      month: '2026-11',
      events_this_month: 4200,
      measured_at: MEASURED_AT.toISOString(),
      limits: { events_per_month: 100_000, projects: 3, people: 3, pause_at_events: 150_000 },
    });
  });

  it('hides the billing dates from a member, and shows a month not measured yet as null', () => {
    expect(
      myAccountBody({
        account: { ...ACCOUNT, accessEndsAt: null, ingestionPausedUntil: null },
        role: 'member',
        month: '2026-11',
        usage: null,
        limits: HOSTED_PLAN_LIMITS,
        pauseAtEvents: 150_000,
        held: null,
      }),
    ).toEqual(
      expect.objectContaining({
        role: 'member',
        billing_interval: null,
        trial_ends_at: null,
        current_period_ends_at: null,
        access_ends_at: null,
        ingestion_paused_until: null,
        events_this_month: null,
        measured_at: null,
        project_count: null,
        people_count: null,
      }),
    );
  });

  it('shows the owner, and only the owner, the day an account over the free plan must fit by', () => {
    const overTheLimits = {
      ...ACCOUNT,
      status: 'free' as const,
      freePlanFitDueAt: new Date('2026-12-20T15:00:00.000Z'),
    };
    const body = (role: 'owner' | 'member') =>
      myAccountBody({
        account: overTheLimits,
        role,
        month: '2026-11',
        usage: null,
        limits: HOSTED_PLAN_LIMITS,
        pauseAtEvents: 10_000,
        held: null,
      }).free_plan_fit_due_at;

    expect(body('owner')).toBe('2026-12-20T15:00:00.000Z');
    expect(body('member')).toBeNull();
  });

  it('shows everyone that the account is suspended, and only the owner why', () => {
    const suspended = {
      ...ACCOUNT,
      suspendedAt: new Date('2026-11-20T10:00:00.000Z'),
      suspensionReason: 'Forged traffic',
    };
    const body = (role: 'owner' | 'member') =>
      myAccountBody({
        account: suspended,
        role,
        month: '2026-11',
        usage: null,
        limits: HOSTED_PLAN_LIMITS,
        pauseAtEvents: 150_000,
        held: null,
      });

    expect(body('owner')).toEqual(
      expect.objectContaining({
        suspended_at: '2026-11-20T10:00:00.000Z',
        suspension_reason: 'Forged traffic',
      }),
    );
    expect(body('member')).toEqual(
      expect.objectContaining({
        suspended_at: '2026-11-20T10:00:00.000Z',
        suspension_reason: null,
      }),
    );
  });

  it('shows anyone in the account until when it is exempt from the pause', () => {
    const exempt = { ...ACCOUNT, quotaPauseExemptUntil: new Date('2027-01-15T00:00:00.000Z') };

    expect(
      myAccountBody({
        account: exempt,
        role: 'member',
        month: '2026-11',
        usage: null,
        limits: HOSTED_PLAN_LIMITS,
        pauseAtEvents: 150_000,
        held: null,
      }).quota_pause_exempt_until,
    ).toBe('2027-01-15T00:00:00.000Z');
  });

  it('shows the owner, and only the owner, since when the account waits for a free place', () => {
    const waiting = {
      ...ACCOUNT,
      status: 'incomplete' as const,
      freeWaitlistedAt: new Date('2026-11-20T09:00:00.000Z'),
    };
    const body = (role: 'owner' | 'member') =>
      myAccountBody({
        account: waiting,
        role,
        month: '2026-11',
        usage: null,
        limits: HOSTED_PLAN_LIMITS,
        pauseAtEvents: 150_000,
        held: null,
      }).free_waitlisted_at;

    expect(body('owner')).toBe('2026-11-20T09:00:00.000Z');
    expect(body('member')).toBeNull();
  });

  it('shows the owner, and only the owner, that the deletion is held', () => {
    const held = { ...ACCOUNT, deletionHeldAt: new Date('2026-11-21T10:00:00.000Z') };
    const body = (role: 'owner' | 'member') =>
      myAccountBody({
        account: held,
        role,
        month: '2026-11',
        usage: null,
        limits: HOSTED_PLAN_LIMITS,
        pauseAtEvents: 150_000,
        held: null,
      });

    expect(body('owner').deletion_held_at).toBe('2026-11-21T10:00:00.000Z');
    expect(body('member').deletion_held_at).toBeNull();
  });

  it('shows an owner without billing dates yet as null', () => {
    expect(
      myAccountBody({
        account: {
          ...ACCOUNT,
          status: 'incomplete',
          billingInterval: null,
          trialEndsAt: null,
          currentPeriodEndsAt: null,
        },
        role: 'owner',
        month: '2026-11',
        usage: null,
        limits: HOSTED_PLAN_LIMITS,
        pauseAtEvents: 150_000,
        held: null,
      }),
    ).toEqual(
      expect.objectContaining({
        billing_interval: null,
        trial_ends_at: null,
        current_period_ends_at: null,
      }),
    );
  });
});

describe('AccountsController', () => {
  it("lists the signed-in admin's accounts", async () => {
    const { controller } = accountsController([
      {
        account: ACCOUNT,
        role: 'owner',
        month: '2026-11',
        usage: null,
        limits: HOSTED_PLAN_LIMITS,
        pauseAtEvents: 150_000,
        held: null,
      },
    ]);

    const body = await controller.accounts(signedIn());

    expect(body.accounts.map((account) => account.id)).toEqual([ACCOUNT.id]);
  });

  it('opens a Checkout for the owner, in the language of the page', async () => {
    const { controller, checkouts } = accountsController();

    const body = await controller.checkout(signedIn(), ACCOUNT.id, {
      interval: 'month',
      locale: 'pt-BR',
    });

    expect(body).toEqual({ url: 'https://checkout.example.com/1' });
    expect(checkouts).toEqual([
      {
        adminUserId: ADMIN.id,
        ownerEmail: ADMIN.email,
        accountId: ACCOUNT.id,
        interval: 'month',
        language: 'pt-BR',
      },
    ]);
  });

  it('opens the billing portal for the owner, in English when no language is given', async () => {
    const { controller, portals } = accountsController();

    const body = await controller.portal(signedIn(), ACCOUNT.id, {});

    expect(body).toEqual({ url: 'https://portal.example.com/1' });
    expect(portals).toEqual([{ adminUserId: ADMIN.id, accountId: ACCOUNT.id, language: 'en' }]);
  });

  it("closes the account with the owner's typed address, in the owner's language", async () => {
    const { controller, closures } = accountsController();

    const body = await controller.close(signedIn(), ACCOUNT.id, {
      confirm_email: 'founder@example.com',
    });

    expect(closures).toEqual([
      {
        adminUserId: ADMIN.id,
        ownerEmail: ADMIN.email,
        ownerLanguage: 'en',
        accountId: ACCOUNT.id,
        confirmEmail: 'founder@example.com',
      },
    ]);
    expect(body).toEqual({
      access_ends_at: '2026-11-20T15:00:00.000Z',
      deletion_on: '2026-12-20T15:00:00.000Z',
      refunded_amount: 3900,
    });
  });
});

describe('AccountsController withdraw', () => {
  it('withdraws the account of the signed-in owner and answers the refund and the free plan', async () => {
    const { controller, withdrawals } = accountsController();

    expect(await controller.withdraw(signedIn(), 'acc00000-0000-4000-a000-000000000001')).toEqual({
      status: 'free',
      refunded_amount: 3900,
      fit_by: '2026-12-20T15:00:00.000Z',
    });
    expect(withdrawals).toEqual([
      {
        adminUserId: ADMIN.id,
        ownerEmail: ADMIN.email,
        ownerLanguage: ADMIN.emailLanguage,
        accountId: 'acc00000-0000-4000-a000-000000000001',
      },
    ]);
  });
});
