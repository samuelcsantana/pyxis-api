import { Logger } from '@nestjs/common';
import type { AccountStatus } from '../../domain/accounts/account-status';
import type { PaidInvoice } from '../../domain/billing/billing-gateway';
import { AccountEndedError, AccountNotFoundError } from '../../domain/errors/account.errors';
import { BillingUnavailableError } from '../../domain/errors/billing.errors';
import { FakeBillingGateway } from '../../test-utils/fake-billing-gateway';
import { FixedClock } from '../../test-utils/fixed-clock';
import { InMemoryAccountClosureRepository } from '../../test-utils/in-memory-account-closure.repository';
import { InMemoryAccountRepository } from '../../test-utils/in-memory-account.repository';
import { InMemoryAdminUserRepository } from '../../test-utils/in-memory-admin-user.repository';
import { CloseAccountAsOperatorUseCase } from './close-account-as-operator.usecase';

const NOW = new Date('2026-11-11T15:00:00.000Z');
const OWNER_ID = 'ad000000-0000-4000-a000-000000000001';
const MISSING_ID = 'ffffffff-ffff-4fff-bfff-ffffffffffff';
const INVOICE: PaidInvoice = {
  invoiceId: 'in_1',
  amountPaid: 3900,
  periodStart: new Date('2026-11-01T00:00:00.000Z'),
  periodEnd: new Date('2026-12-01T00:00:00.000Z'),
};

async function setup(status: AccountStatus = 'active', subscriptionId: string | null = 'sub_1') {
  const accounts = new InMemoryAccountRepository(new InMemoryAdminUserRepository());
  const account = await accounts.create({ ownerAdminId: OWNER_ID, status });
  const closure = new InMemoryAccountClosureRepository();
  if (subscriptionId !== null) {
    closure.subscribe(account.id, subscriptionId);
  }
  const gateway = new FakeBillingGateway();
  gateway.latestInvoice = INVOICE;
  const useCase = new CloseAccountAsOperatorUseCase(
    accounts,
    closure,
    gateway,
    new FixedClock(NOW),
  );
  return { accounts, account, closure, gateway, useCase };
}

describe('CloseAccountAsOperatorUseCase', () => {
  let error: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('cancels the subscription, refunds the whole latest invoice and ends access now', async () => {
    const { account, closure, gateway, useCase } = await setup();

    const closed = await useCase.execute({ accountId: account.id, refund: 'full' });

    expect(closed).toEqual({
      accountId: account.id,
      accessEndsAt: NOW,
      deletionOn: new Date('2026-12-11T15:00:00.000Z'),
      subscriptionCancelled: true,
      refundedAmount: 3900,
      refundFailed: false,
    });
    expect(gateway.cancelled).toEqual(['sub_1']);
    expect(gateway.invoiceRefunds).toEqual([{ invoiceId: 'in_1', amount: 3900 }]);
    expect(closure.closed.get(account.id)).toEqual(NOW);
    expect(closure.notified.has(account.id)).toBe(false);
  });

  it('refunds the days left from today, or from the start of a suspension', async () => {
    const running = await setup();
    const suspended = await setup();
    suspended.accounts.add({
      ...suspended.account,
      suspendedAt: new Date('2026-11-06T09:00:00.000Z'),
      suspensionReason: 'Forged traffic',
    });

    await running.useCase.execute({ accountId: running.account.id, refund: 'prorata' });
    await suspended.useCase.execute({ accountId: suspended.account.id, refund: 'prorata' });

    expect(running.gateway.invoiceRefunds).toEqual([
      { invoiceId: 'in_1', amount: Math.floor((3900 * 19) / 30) },
    ]);
    expect(suspended.gateway.invoiceRefunds).toEqual([
      { invoiceId: 'in_1', amount: Math.floor((3900 * 24) / 30) },
    ]);
  });

  it('cancels without refunding when told so, or when nothing was paid yet', async () => {
    const none = await setup();
    const unpaid = await setup('trialing');
    unpaid.gateway.latestInvoice = null;
    const used = await setup();
    used.gateway.latestInvoice = { ...INVOICE, periodEnd: new Date('2026-11-11T20:00:00.000Z') };

    const refusals = [
      await none.useCase.execute({ accountId: none.account.id, refund: 'none' }),
      await unpaid.useCase.execute({ accountId: unpaid.account.id, refund: 'full' }),
      await used.useCase.execute({ accountId: used.account.id, refund: 'prorata' }),
    ];

    expect(
      refusals.map(({ refundedAmount, subscriptionCancelled }) => [
        refundedAmount,
        subscriptionCancelled,
      ]),
    ).toEqual([
      [0, true],
      [0, true],
      [0, true],
    ]);
    expect([none, unpaid, used].flatMap(({ gateway }) => gateway.invoiceRefunds)).toEqual([]);
  });

  it('closes an account without a subscription to cancel, touching nothing in billing', async () => {
    const comped = await setup('comped', null);
    const incomplete = await setup('incomplete', 'sub_incomplete');

    const closed = await comped.useCase.execute({ accountId: comped.account.id, refund: 'full' });
    await incomplete.useCase.execute({ accountId: incomplete.account.id, refund: 'full' });

    expect(closed).toMatchObject({ subscriptionCancelled: false, refundedAmount: 0 });
    expect([...comped.gateway.cancelled, ...incomplete.gateway.cancelled]).toEqual([]);
    expect(incomplete.closure.closed.get(incomplete.account.id)).toEqual(NOW);
  });

  it('still closes when the refund fails, saying so for a refund by hand', async () => {
    const { account, closure, gateway, useCase } = await setup();
    gateway.refundFailure = new BillingUnavailableError('refunds.create failed');

    const closed = await useCase.execute({ accountId: account.id, refund: 'full' });

    expect(closed).toMatchObject({ refundedAmount: 0, refundFailed: true });
    expect(closure.closed.get(account.id)).toEqual(NOW);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'accounts.refund_failed', accountId: account.id }),
    );
  });

  it('closes nothing when Stripe cannot cancel the subscription', async () => {
    const { account, closure, gateway, useCase } = await setup();
    gateway.cancelFailure = new BillingUnavailableError('subscriptions.cancel failed');

    await expect(useCase.execute({ accountId: account.id, refund: 'full' })).rejects.toBeInstanceOf(
      BillingUnavailableError,
    );
    expect(closure.closed.has(account.id)).toBe(false);
  });

  it('answers not found for an unknown account and refuses one already ended', async () => {
    const { useCase } = await setup();
    const ended = await setup('ended');

    await expect(useCase.execute({ accountId: MISSING_ID, refund: 'full' })).rejects.toBeInstanceOf(
      AccountNotFoundError,
    );
    await expect(
      ended.useCase.execute({ accountId: ended.account.id, refund: 'full' }),
    ).rejects.toBeInstanceOf(AccountEndedError);
  });
});
