import type { FastifyRequest } from 'fastify';
import { HOSTED_PLAN_LIMITS } from '../../../domain/accounts/hosted-plan';
import type { Account } from '../../../domain/entities/account.entity';
import type { AdminUser } from '../../../domain/entities/admin-user.entity';
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
  createdAt: new Date('2026-11-01T00:00:00.000Z'),
};
const MEASURED_AT = new Date('2026-11-02T03:00:00.000Z');

function signedIn(): FastifyRequest {
  return { admin: ADMIN } as unknown as FastifyRequest;
}

function accountsController(accounts: readonly MyAccount[] = []) {
  const checkouts: StartCheckoutCommand[] = [];
  const portals: OpenBillingPortalCommand[] = [];
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
  );
  return { controller, checkouts, portals };
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
      month: '2026-11',
      events_this_month: 4200,
      measured_at: MEASURED_AT.toISOString(),
      limits: { events_per_month: 100_000, projects: 3, people: 3 },
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
      }),
    );
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
});
