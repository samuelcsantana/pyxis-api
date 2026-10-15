import { BillingUnavailableError } from '../../domain/errors/billing.errors';
import { createBillingGateway, UnconfiguredBillingGateway } from './create-billing-gateway';
import { StripeBillingGateway } from './stripe-billing-gateway';

describe('createBillingGateway', () => {
  it('talks to Stripe with a secret or restricted key', () => {
    expect(createBillingGateway({ STRIPE_SECRET_KEY: 'sk_test_abc123' })).toBeInstanceOf(
      StripeBillingGateway,
    );
    expect(
      createBillingGateway({
        STRIPE_SECRET_KEY: 'rk_live_abc123',
        STRIPE_WEBHOOK_SECRET: 'whsec_abc123',
      }),
    ).toBeInstanceOf(StripeBillingGateway);
  });

  it('treats a missing key, or the parameter placeholder, as billing not set up', () => {
    expect(createBillingGateway({})).toBeInstanceOf(UnconfiguredBillingGateway);
    expect(
      createBillingGateway({ STRIPE_SECRET_KEY: 'placeholder-set-in-the-console' }),
    ).toBeInstanceOf(UnconfiguredBillingGateway);
  });

  it('refuses webhook events when the webhook secret is still the placeholder', () => {
    const gateway = createBillingGateway({
      STRIPE_SECRET_KEY: 'sk_test_abc123',
      STRIPE_WEBHOOK_SECRET: 'placeholder-set-in-the-console',
    });

    expect(() => gateway.parseEvent(Buffer.from('{}'), 't=1,v1=x')).toThrow(
      BillingUnavailableError,
    );
  });
});

describe('UnconfiguredBillingGateway', () => {
  it('answers every call with billing unavailable', async () => {
    const gateway = new UnconfiguredBillingGateway();

    await expect(gateway.createCheckout()).rejects.toBeInstanceOf(BillingUnavailableError);
    await expect(gateway.createPortal()).rejects.toBeInstanceOf(BillingUnavailableError);
    await expect(gateway.subscription()).rejects.toBeInstanceOf(BillingUnavailableError);
    await expect(gateway.cancelSubscription()).rejects.toBeInstanceOf(BillingUnavailableError);
    await expect(gateway.refundFirstPaymentSince()).rejects.toBeInstanceOf(BillingUnavailableError);
    await expect(gateway.latestPaidInvoice()).rejects.toBeInstanceOf(BillingUnavailableError);
    await expect(gateway.refundInvoice()).rejects.toBeInstanceOf(BillingUnavailableError);
    expect(() => gateway.parseEvent()).toThrow(BillingUnavailableError);
  });
});
