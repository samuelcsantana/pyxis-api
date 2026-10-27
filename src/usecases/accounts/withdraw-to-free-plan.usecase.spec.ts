import { Logger } from '@nestjs/common';
import type { SignUpSettings } from '../../domain/accounts/sign-up-settings';
import type { Account } from '../../domain/entities/account.entity';
import {
  AccountNotFoundError,
  FreePlanClosedError,
  WithdrawalUnavailableError,
  WithdrawalWindowClosedError,
} from '../../domain/errors/account.errors';
import { FakeBillingGateway } from '../../test-utils/fake-billing-gateway';
import { FixedClock } from '../../test-utils/fixed-clock';
import { RecordingMailSender } from '../../test-utils/recording-mail-sender';
import { InMemoryAccountWithdrawalRepository } from '../../test-utils/in-memory-account-withdrawal.repository';
import { InMemoryAccountRepository } from '../../test-utils/in-memory-account.repository';
import { InMemoryAdminUserRepository } from '../../test-utils/in-memory-admin-user.repository';
import { InMemoryFreePlanFallbackRepository } from '../../test-utils/in-memory-free-plan-fallback.repository';
import { NO_LIMIT_OVERRIDES } from '../../domain/accounts/account-limits';
import { WithdrawToFreePlanUseCase } from './withdraw-to-free-plan.usecase';

const NOW = new Date('2026-11-20T15:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const OWNER = 'owner-1';
const WHO = {
  adminUserId: OWNER,
  ownerEmail: 'owner@example.com',
  ownerLanguage: 'pt-BR',
} as const;
const SETTINGS: SignUpSettings = {
  open: true,
  termsVersion: '1.3',
  termsUrl: 'https://example.com/termos',
  dashboardOrigin: 'https://app.example.com',
  freePlanOpen: true,
  freeAccountsMax: 200,
  trialOffered: false,
  freePlanTermsForEarlierAccountsFrom: null,
};

async function setup(status: Account['status'] = 'active', settings: SignUpSettings = SETTINGS) {
  const accounts = new InMemoryAccountRepository(new InMemoryAdminUserRepository());
  const account = await accounts.create({ ownerAdminId: OWNER, status });
  const withdrawals = new InMemoryAccountWithdrawalRepository();
  withdrawals.subscribe(account.id, 'sub_1');
  const gateway = new FakeBillingGateway();
  gateway.paidFirstOn('sub_1', new Date(NOW.getTime() - 2 * DAY_MS));
  const mail = new RecordingMailSender();
  const fallbacks = new InMemoryFreePlanFallbackRepository();
  const useCase = new WithdrawToFreePlanUseCase(
    accounts,
    withdrawals,
    gateway,
    new FixedClock(NOW),
    settings,
    mail,
    fallbacks,
  );
  return { account, withdrawals, gateway, mail, fallbacks, useCase };
}

describe('WithdrawToFreePlanUseCase', () => {
  let error: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('cancels at once, refunds the first payment of the window and puts the account back on free', async () => {
    const { account, withdrawals, gateway, mail, useCase } = await setup();
    gateway.refundAmount = 3900;

    expect(await useCase.execute({ ...WHO, accountId: account.id })).toEqual({
      refundedAmount: 3900,
      fitBy: null,
    });
    expect(gateway.cancelled).toEqual(['sub_1']);
    expect(gateway.refunds).toEqual([
      { subscriptionId: 'sub_1', since: new Date(NOW.getTime() - 7 * DAY_MS) },
    ]);
    expect(withdrawals.returnedToFree).toEqual([account.id]);
    expect(withdrawals.fitDueAt.get(account.id)).toBeNull();
    expect(mail.accountNotices).toEqual([
      {
        email: 'owner@example.com',
        notice: { kind: 'withdrawn_to_free', refundedAmount: 3900, fitBy: null },
        language: 'pt-BR',
      },
    ]);
  });

  it('gives an account over the free plan thirty days to fit, and says until when', async () => {
    const { account, withdrawals, gateway, mail, fallbacks, useCase } = await setup();
    gateway.refundAmount = 3900;
    fallbacks.add({
      accountId: account.id,
      ownerEmail: 'owner@example.com',
      ownerLanguage: 'pt-BR',
      eventsPerMonthLimit: null,
      status: 'active',
      fit: {
        ...NO_LIMIT_OVERRIDES,
        projects: 3,
        people: 1,
        acceptedTermsVersions: ['1.3'],
        ownerHasAnotherFreeAccount: false,
      },
    });
    const fitBy = new Date(NOW.getTime() + 30 * DAY_MS);

    expect(await useCase.execute({ ...WHO, accountId: account.id })).toEqual({
      refundedAmount: 3900,
      fitBy,
    });
    expect(withdrawals.fitDueAt.get(account.id)).toEqual(fitBy);
    expect(mail.accountNotices[0]?.notice).toEqual({
      kind: 'withdrawn_to_free',
      refundedAmount: 3900,
      fitBy,
    });
  });

  it('keeps the withdrawal when the e-mail fails, and says so in the log', async () => {
    const { account, withdrawals, mail, useCase } = await setup();
    mail.failFor('owner@example.com', new Error('provider down'));

    await useCase.execute({ ...WHO, accountId: account.id });

    expect(withdrawals.returnedToFree).toEqual([account.id]);
    expect(error).toHaveBeenCalledWith({
      message: 'accounts.notice_failed',
      kind: 'withdrawn_to_free',
      accountId: account.id,
      reason: 'Error: provider down',
    });
  });

  it.each(['past_due', 'ending'] as const)('withdraws a %s subscription too', async (status) => {
    const { account, withdrawals, useCase } = await setup(status);

    await useCase.execute({ ...WHO, accountId: account.id });

    expect(withdrawals.returnedToFree).toEqual([account.id]);
  });

  it('puts the account back on free even when the refund fails, and logs it for a refund by hand', async () => {
    const { account, withdrawals, gateway, useCase } = await setup();
    gateway.refundFailure = new Error('stripe down');

    expect(await useCase.execute({ ...WHO, accountId: account.id })).toEqual({
      refundedAmount: 0,
      fitBy: null,
    });
    expect(withdrawals.returnedToFree).toEqual([account.id]);
    expect(error).toHaveBeenCalledWith({
      message: 'accounts.refund_failed',
      accountId: account.id,
      reason: 'Error: stripe down',
    });
  });

  it('changes nothing when Stripe cannot cancel the subscription', async () => {
    const { account, withdrawals, gateway, useCase } = await setup();
    gateway.cancelFailure = new Error('stripe down');

    await expect(useCase.execute({ ...WHO, accountId: account.id })).rejects.toThrow('stripe down');
    expect(withdrawals.returnedToFree).toEqual([]);
  });

  it('refuses once the 7 days of the first payment are over, and withdraws on the last moment', async () => {
    const late = await setup();
    late.gateway.paidFirstOn('sub_1', new Date(NOW.getTime() - 7 * DAY_MS - 1));
    const lastMoment = await setup();
    lastMoment.gateway.paidFirstOn('sub_1', new Date(NOW.getTime() - 7 * DAY_MS));

    await expect(
      late.useCase.execute({ ...WHO, accountId: late.account.id }),
    ).rejects.toBeInstanceOf(WithdrawalWindowClosedError);
    expect(late.gateway.cancelled).toEqual([]);
    await expect(
      lastMoment.useCase.execute({ ...WHO, accountId: lastMoment.account.id }),
    ).resolves.toBeDefined();
  });

  it('refuses a subscription with no payment at all', async () => {
    const { account, withdrawals, gateway, useCase } = await setup();
    withdrawals.subscribe(account.id, 'sub_never_paid');

    await expect(useCase.execute({ ...WHO, accountId: account.id })).rejects.toBeInstanceOf(
      WithdrawalWindowClosedError,
    );
    expect(gateway.cancelled).toEqual([]);
  });

  it.each(['free', 'trialing', 'incomplete', 'ended', 'comped'] as const)(
    'refuses a %s account, which has no paid subscription to withdraw from',
    async (status) => {
      const { account, useCase } = await setup(status);

      await expect(useCase.execute({ ...WHO, accountId: account.id })).rejects.toBeInstanceOf(
        WithdrawalUnavailableError,
      );
    },
  );

  it('refuses a paying account whose subscription it does not know', async () => {
    const { account, withdrawals, useCase } = await setup();
    await withdrawals.returnToFreePlan(account.id, null);

    await expect(useCase.execute({ ...WHO, accountId: account.id })).rejects.toBeInstanceOf(
      WithdrawalUnavailableError,
    );
  });

  it('refuses while the free plan is closed, and someone who does not own the account', async () => {
    const closed = await setup('active', { ...SETTINGS, freePlanOpen: false });
    const stranger = await setup();

    await expect(
      closed.useCase.execute({ ...WHO, accountId: closed.account.id }),
    ).rejects.toBeInstanceOf(FreePlanClosedError);
    await expect(
      stranger.useCase.execute({
        ...WHO,
        adminUserId: 'someone-else',
        accountId: stranger.account.id,
      }),
    ).rejects.toBeInstanceOf(AccountNotFoundError);
    expect(closed.gateway.cancelled).toEqual([]);
  });
});
