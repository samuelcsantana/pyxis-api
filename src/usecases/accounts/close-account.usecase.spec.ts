import { Logger } from '@nestjs/common';
import type { AccountStatus } from '../../domain/accounts/account-status';
import {
  AccountEndedError,
  AccountNotFoundError,
  ConfirmationMismatchError,
} from '../../domain/errors/account.errors';
import { BillingUnavailableError } from '../../domain/errors/billing.errors';
import { FakeBillingGateway } from '../../test-utils/fake-billing-gateway';
import { FixedClock } from '../../test-utils/fixed-clock';
import { InMemoryAccountClosureRepository } from '../../test-utils/in-memory-account-closure.repository';
import { InMemoryAccountRepository } from '../../test-utils/in-memory-account.repository';
import { InMemoryAdminUserRepository } from '../../test-utils/in-memory-admin-user.repository';
import { RecordingMailSender } from '../../test-utils/recording-mail-sender';
import { CloseAccountUseCase } from './close-account.usecase';

const NOW = new Date('2026-11-20T15:00:00.000Z');
const OWNER_ID = 'ad000000-0000-4000-a000-000000000001';
const OWNER_EMAIL = 'owner@example.com';

async function setup(status: AccountStatus = 'active', subscriptionId: string | null = 'sub_1') {
  const accounts = new InMemoryAccountRepository(new InMemoryAdminUserRepository());
  const account = await accounts.create({ ownerAdminId: OWNER_ID, status });
  const closure = new InMemoryAccountClosureRepository();
  if (subscriptionId !== null) {
    closure.subscribe(account.id, subscriptionId);
  }
  const gateway = new FakeBillingGateway();
  const mail = new RecordingMailSender();
  const useCase = new CloseAccountUseCase(accounts, closure, gateway, mail, new FixedClock(NOW));
  const command = {
    adminUserId: OWNER_ID,
    ownerEmail: OWNER_EMAIL,
    ownerLanguage: 'pt-BR' as const,
    accountId: account.id,
    confirmEmail: ' Owner@Example.com ',
  };
  return { account, closure, gateway, mail, useCase, command };
}

describe('CloseAccountUseCase', () => {
  let error: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('cancels the subscription, refunds a first payment of the last seven days, and closes now', async () => {
    const { closure, gateway, mail, useCase, command, account } = await setup();
    gateway.refundAmount = 3900;

    const closed = await useCase.execute(command);

    expect(closed).toEqual({
      accessEndsAt: NOW,
      deletionOn: new Date('2026-12-20T15:00:00.000Z'),
      refundedAmount: 3900,
    });
    expect(gateway.cancelled).toEqual(['sub_1']);
    expect(gateway.refunds).toEqual([
      { subscriptionId: 'sub_1', since: new Date('2026-11-13T15:00:00.000Z') },
    ]);
    expect(closure.closed.get(account.id)).toEqual(NOW);
    expect(closure.notified.get(account.id)).toEqual(NOW);
    expect(mail.accountNotices).toEqual([
      {
        email: OWNER_EMAIL,
        notice: { kind: 'access_ended', deletionOn: new Date('2026-12-20T15:00:00.000Z') },
        language: 'pt-BR',
      },
    ]);
  });

  it.each(['trialing', 'past_due', 'ending'] as const)(
    'cancels the subscription of a %s account too',
    async (status) => {
      const { gateway, useCase, command } = await setup(status);

      await useCase.execute(command);

      expect(gateway.cancelled).toEqual(['sub_1']);
    },
  );

  it('closes an account without a running subscription without calling Stripe', async () => {
    const comped = await setup('comped', null);
    const incomplete = await setup('incomplete', 'sub_old');

    expect((await comped.useCase.execute(comped.command)).refundedAmount).toBe(0);
    await incomplete.useCase.execute(incomplete.command);

    expect(comped.gateway.cancelled).toEqual([]);
    expect(incomplete.gateway.cancelled).toEqual([]);
    expect(incomplete.closure.closed.size).toBe(1);
  });

  it('closes nothing when Stripe cannot cancel, so the owner can try again', async () => {
    const { closure, gateway, useCase, command } = await setup();
    gateway.cancelFailure = new BillingUnavailableError('subscriptions.cancel failed');

    await expect(useCase.execute(command)).rejects.toBeInstanceOf(BillingUnavailableError);
    expect(closure.closed.size).toBe(0);
  });

  it('still closes when the refund fails, and logs it for a refund by hand', async () => {
    const { closure, gateway, useCase, command, account } = await setup();
    gateway.refundFailure = new BillingUnavailableError('refunds.create failed');

    expect((await useCase.execute(command)).refundedAmount).toBe(0);
    expect(closure.closed.has(account.id)).toBe(true);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'accounts.refund_failed', accountId: account.id }),
    );
  });

  it('leaves the notice to the daily job when the e-mail fails', async () => {
    const { closure, mail, useCase, command, account } = await setup();
    mail.failFor(OWNER_EMAIL, new Error('provider down'));

    await useCase.execute(command);

    expect(closure.notified.has(account.id)).toBe(false);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'accounts.notice_failed', kind: 'access_ended' }),
    );
  });

  it('refuses an ended account, a wrong confirmation and someone who is not the owner', async () => {
    const ended = await setup('ended');
    const active = await setup();

    await expect(ended.useCase.execute(ended.command)).rejects.toBeInstanceOf(AccountEndedError);
    await expect(
      active.useCase.execute({ ...active.command, confirmEmail: 'someone@example.com' }),
    ).rejects.toBeInstanceOf(ConfirmationMismatchError);
    await expect(
      active.useCase.execute({ ...active.command, adminUserId: 'stranger' }),
    ).rejects.toBeInstanceOf(AccountNotFoundError);
    expect(active.gateway.cancelled).toEqual([]);
  });
});
