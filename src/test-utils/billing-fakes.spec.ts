import { FakeBillingGateway } from './fake-billing-gateway';

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
