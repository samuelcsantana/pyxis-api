import { FakeBillingGateway } from './fake-billing-gateway';
import { InMemoryTrialCardRepository } from './in-memory-trial-card.repository';
import { InMemoryFreePlanFallbackRepository } from './in-memory-free-plan-fallback.repository';

describe('FakeBillingGateway', () => {
  it('records the Checkouts and portals it opens and answers a URL for each', async () => {
    const gateway = new FakeBillingGateway();
    const checkout = {
      accountId: 'acc00000-0000-4000-a000-000000000001',
      customerId: null,
      customerEmail: 'owner@example.com',
      interval: 'month' as const,
      language: 'en' as const,
      trialDays: 14,
      successUrl: 'https://app.example.com/welcome',
      cancelUrl: 'https://app.example.com/sign-up',
    };

    await expect(gateway.createCheckout(checkout)).resolves.toEqual({
      url: 'https://checkout.example.com/acc00000-0000-4000-a000-000000000001',
    });
    await expect(
      gateway.createPortal('cus_1', 'https://app.example.com/account', 'es'),
    ).resolves.toEqual({ url: 'https://portal.example.com/cus_1' });
    expect(gateway.checkouts).toEqual([checkout]);
    expect(gateway.portals).toEqual([
      { customerId: 'cus_1', returnUrl: 'https://app.example.com/account', language: 'es' },
    ]);
  });
});

describe('InMemoryTrialCardRepository', () => {
  it('records a card once per account and names the other accounts, earliest first', async () => {
    const cards = new InMemoryTrialCardRepository();
    const later = { fingerprint: 'fp_1', accountId: 'b', trialStartedAt: new Date(2000) };
    const earlier = { fingerprint: 'fp_1', accountId: 'a', trialStartedAt: new Date(1000) };

    expect(await cards.record(later)).toBe(true);
    expect(await cards.record(earlier)).toBe(true);
    expect(await cards.record({ ...later, trialStartedAt: new Date(3000) })).toBe(false);
    expect(
      await cards.record({ fingerprint: 'fp_2', accountId: 'b', trialStartedAt: new Date(1) }),
    ).toBe(true);

    expect(await cards.otherAccountIds('fp_1', 'c')).toEqual(['a', 'b']);
    expect(await cards.otherAccountIds('fp_1', 'a')).toEqual(['b']);
    expect(cards.cards).toHaveLength(3);
  });
});

describe('InMemoryFreePlanFallbackRepository', () => {
  it('ends only what it knows, and moves back to free only an account still running', async () => {
    const fallbacks = new InMemoryFreePlanFallbackRepository();
    const at = new Date(1000);

    await fallbacks.endUnfit('unknown', at);

    expect(fallbacks.ended).toEqual([{ accountId: 'unknown', at }]);
    expect(fallbacks.statusOf('unknown')).toBeUndefined();
    expect(await fallbacks.fallBack('unknown', at)).toBe(false);
    expect(await fallbacks.toNotify('unknown')).toBeNull();
  });
});
