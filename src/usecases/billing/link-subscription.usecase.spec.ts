import type { BillingSubscription } from '../../domain/billing/billing-gateway';
import { AccountNotFoundError } from '../../domain/errors/account.errors';
import { BillingUnavailableError } from '../../domain/errors/billing.errors';
import { FakeBillingGateway } from '../../test-utils/fake-billing-gateway';
import { FixedClock } from '../../test-utils/fixed-clock';
import { InMemoryAccountBillingRepository } from '../../test-utils/in-memory-account-billing.repository';
import { LinkSubscriptionUseCase } from './link-subscription.usecase';

const ACCOUNT_ID = 'acc00000-0000-4000-a000-000000000001';
const PERIOD_END = new Date('2026-11-14T00:00:00.000Z');
const PAID_BY_LINK: BillingSubscription = {
  subscriptionId: 'sub_link',
  customerId: 'cus_link',
  accountId: null,
  status: 'active',
  interval: 'month',
  trialEndsAt: null,
  currentPeriodEndsAt: PERIOD_END,
  cancelAtPeriodEnd: false,
  cardFingerprint: null,
};

function setup() {
  const gateway = new FakeBillingGateway();
  const accounts = new InMemoryAccountBillingRepository();
  accounts.add({
    accountId: ACCOUNT_ID,
    status: 'comped',
    accessEndsAt: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
  });
  const useCase = new LinkSubscriptionUseCase(
    gateway,
    accounts,
    new FixedClock(new Date('2026-10-14T00:00:00.000Z')),
  );
  return { gateway, accounts, useCase };
}

describe('LinkSubscriptionUseCase', () => {
  it('puts a subscription paid through a payment link on an existing account', async () => {
    const { gateway, accounts, useCase } = setup();
    gateway.addSubscription(PAID_BY_LINK);

    const update = await useCase.execute({ accountId: ACCOUNT_ID, subscriptionId: 'sub_link' });

    expect(update).toMatchObject({ status: 'active', stripeSubscriptionId: 'sub_link' });
    expect(accounts.stored(ACCOUNT_ID)).toMatchObject({
      status: 'active',
      stripeCustomerId: 'cus_link',
    });
  });

  it('refuses an account that does not exist, before asking Stripe', async () => {
    const { gateway, useCase } = setup();

    await expect(
      useCase.execute({
        accountId: 'ffffffff-ffff-4fff-bfff-ffffffffffff',
        subscriptionId: 'sub_link',
      }),
    ).rejects.toBeInstanceOf(AccountNotFoundError);
    expect(gateway.subscriptionReads).toEqual([]);
  });

  it('changes nothing when Stripe does not answer', async () => {
    const { accounts, useCase } = setup();

    await expect(
      useCase.execute({ accountId: ACCOUNT_ID, subscriptionId: 'sub_missing' }),
    ).rejects.toBeInstanceOf(BillingUnavailableError);
    expect(accounts.updates).toEqual([]);
  });
});
