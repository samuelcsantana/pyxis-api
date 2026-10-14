import { Logger } from '@nestjs/common';
import Stripe from 'stripe';
import type { CheckoutRequest } from '../../domain/billing/billing-gateway';
import {
  BillingUnavailableError,
  InvalidBillingSignatureError,
} from '../../domain/errors/billing.errors';
import { fakeStripe } from '../../test-utils/stripe-fake-http';
import {
  StripeBillingGateway,
  toBillingEvent,
  toBillingSubscription,
} from './stripe-billing-gateway';

const ACCOUNT_ID = 'acc00000-0000-4000-a000-000000000001';
const WEBHOOK_SECRET = 'whsec_test_secret';
const MONTHLY_PRICE = { object: 'list', data: [{ id: 'price_monthly', object: 'price' }] };
const CHECKOUT: CheckoutRequest = {
  accountId: ACCOUNT_ID,
  customerId: null,
  customerEmail: 'owner@example.com',
  interval: 'month',
  language: 'pt-BR',
  trialDays: 14,
  successUrl: 'https://app.example.com/welcome?session={CHECKOUT_SESSION_ID}',
  cancelUrl: 'https://app.example.com/sign-up?step=plan',
};

function subscription(overrides: Partial<Stripe.Subscription> = {}): Stripe.Subscription {
  return {
    id: 'sub_1',
    object: 'subscription',
    customer: 'cus_1',
    status: 'trialing',
    metadata: { account_id: ACCOUNT_ID },
    trial_end: 1_762_000_000,
    cancel_at: null,
    cancel_at_period_end: false,
    items: {
      object: 'list',
      data: [{ current_period_end: 1_762_000_000, price: { recurring: { interval: 'month' } } }],
    },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

function setup() {
  const fake = fakeStripe();
  return { ...fake, gateway: new StripeBillingGateway(fake.stripe, WEBHOOK_SECRET) };
}

function quietLogs(): string[] {
  const warnings: string[] = [];
  jest.spyOn(Logger.prototype, 'warn').mockImplementation((message: unknown) => {
    warnings.push(JSON.stringify(message));
  });
  return warnings;
}

describe('StripeBillingGateway.createCheckout', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('opens a subscription Checkout with the trial, a card, the address and the terms required', async () => {
    const { gateway, answer, requests } = setup();
    answer('GET', '/v1/prices', { body: MONTHLY_PRICE });
    answer('POST', '/v1/checkout/sessions', {
      body: { id: 'cs_1', object: 'checkout.session', url: 'https://checkout.stripe.com/c/1' },
    });

    const session = await gateway.createCheckout(CHECKOUT);

    expect(session).toEqual({ url: 'https://checkout.stripe.com/c/1' });
    const [prices, checkout] = requests;
    expect(prices?.query.get('lookup_keys[0]')).toBe('pyxis_monthly_brl');
    expect(prices?.query.get('active')).toBe('true');
    expect(Object.fromEntries(checkout?.form ?? [])).toEqual({
      mode: 'subscription',
      'line_items[0][price]': 'price_monthly',
      'line_items[0][quantity]': '1',
      customer_email: 'owner@example.com',
      client_reference_id: ACCOUNT_ID,
      'subscription_data[trial_period_days]': '14',
      'subscription_data[metadata][account_id]': ACCOUNT_ID,
      payment_method_collection: 'always',
      billing_address_collection: 'required',
      'tax_id_collection[enabled]': 'true',
      'consent_collection[terms_of_service]': 'required',
      locale: 'pt-BR',
      success_url: CHECKOUT.successUrl,
      cancel_url: CHECKOUT.cancelUrl,
    });
  });

  it('reuses a known customer and the price it already looked up', async () => {
    const { gateway, answer, requests } = setup();
    answer('GET', '/v1/prices', { body: MONTHLY_PRICE });
    answer('POST', '/v1/checkout/sessions', {
      body: { id: 'cs_2', object: 'checkout.session', url: 'https://checkout.stripe.com/c/2' },
    });

    await gateway.createCheckout({
      ...CHECKOUT,
      customerId: 'cus_9',
      language: 'es',
      trialDays: null,
    });
    await gateway.createCheckout({ ...CHECKOUT, customerId: 'cus_9', language: 'en' });

    expect(requests.map(({ method, path }) => `${method} ${path}`)).toEqual([
      'GET /v1/prices',
      'POST /v1/checkout/sessions',
      'POST /v1/checkout/sessions',
    ]);
    expect(requests[1]?.form.get('customer')).toBe('cus_9');
    expect(requests[1]?.form.has('customer_email')).toBe(false);
    expect(requests[1]?.form.get('locale')).toBe('es');
    expect(requests[1]?.form.has('subscription_data[trial_period_days]')).toBe(false);
    expect(requests[2]?.form.get('locale')).toBe('en');
  });

  it('is unavailable without an active price for the period', async () => {
    const { gateway, answer } = setup();
    answer('GET', '/v1/prices', { body: { object: 'list', data: [] } });

    await expect(gateway.createCheckout({ ...CHECKOUT, interval: 'year' })).rejects.toMatchObject({
      reason: 'no active price has the lookup key pyxis_yearly_brl',
    });
  });

  it('is unavailable when Checkout answers without a URL', async () => {
    const { gateway, answer } = setup();
    answer('GET', '/v1/prices', { body: MONTHLY_PRICE });
    answer('POST', '/v1/checkout/sessions', {
      body: { id: 'cs_3', object: 'checkout.session', url: null },
    });

    await expect(gateway.createCheckout(CHECKOUT)).rejects.toBeInstanceOf(BillingUnavailableError);
  });

  it('logs what Stripe refused and answers only that billing is unavailable', async () => {
    const warnings = quietLogs();
    const { gateway, answer } = setup();
    answer('GET', '/v1/prices', { body: MONTHLY_PRICE });
    answer('POST', '/v1/checkout/sessions', {
      status: 400,
      body: {
        error: {
          type: 'invalid_request_error',
          code: 'parameter_missing',
          message: 'You cannot collect consent to your terms of service unless a URL is set.\nMore',
        },
      },
    });

    await expect(gateway.createCheckout(CHECKOUT)).rejects.toMatchObject({
      code: 'billing_unavailable',
      reason: 'checkout.sessions.create failed',
    });
    expect(warnings).toEqual([expect.stringContaining('"code":"parameter_missing"')]);
    expect(warnings[0]).not.toContain('More');
  });

  it('logs an error that is not Stripe’s with an unknown code', async () => {
    const warnings = quietLogs();
    const gateway = new StripeBillingGateway(
      { prices: { list: () => Promise.reject(new Error('socket hang up')) } } as unknown as Stripe,
      WEBHOOK_SECRET,
    );

    await expect(gateway.createCheckout(CHECKOUT)).rejects.toBeInstanceOf(BillingUnavailableError);
    expect(warnings).toEqual([expect.stringContaining('"code":"unknown"')]);
  });
});

describe('StripeBillingGateway.createPortal and subscription', () => {
  it('opens the customer portal in the reader’s language', async () => {
    const { gateway, answer, requests } = setup();
    answer('POST', '/v1/billing_portal/sessions', {
      body: {
        id: 'bps_1',
        object: 'billing_portal.session',
        url: 'https://billing.stripe.com/p/1',
      },
    });

    const portal = await gateway.createPortal('cus_1', 'https://app.example.com/account', 'en');

    expect(portal).toEqual({ url: 'https://billing.stripe.com/p/1' });
    expect(Object.fromEntries(requests[0]?.form ?? [])).toEqual({
      customer: 'cus_1',
      return_url: 'https://app.example.com/account',
      locale: 'en',
    });
  });

  it('reads a subscription from Stripe', async () => {
    const { gateway, answer } = setup();
    answer('GET', '/v1/subscriptions/sub_1', { body: subscription() });

    expect(await gateway.subscription('sub_1')).toEqual({
      subscriptionId: 'sub_1',
      customerId: 'cus_1',
      accountId: ACCOUNT_ID,
      status: 'trialing',
      interval: 'month',
      trialEndsAt: new Date(1_762_000_000_000),
      currentPeriodEndsAt: new Date(1_762_000_000_000),
      cancelAtPeriodEnd: false,
    });
  });
});

describe('StripeBillingGateway when Stripe does not know the subscription', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('answers that billing is unavailable', async () => {
    quietLogs();
    const { gateway } = setup();

    await expect(gateway.subscription('sub_missing')).rejects.toMatchObject({
      reason: 'subscriptions.retrieve failed',
    });
  });
});

describe('toBillingSubscription', () => {
  it('reads a scheduled end from cancel_at and clamps the dates to it', () => {
    const snapshot = toBillingSubscription(
      subscription({ cancel_at: 1_761_000_000, customer: { id: 'cus_2' } as Stripe.Customer }),
    );

    expect(snapshot).toMatchObject({
      customerId: 'cus_2',
      cancelAtPeriodEnd: true,
      trialEndsAt: new Date(1_761_000_000_000),
      currentPeriodEndsAt: new Date(1_761_000_000_000),
    });
  });

  it('keeps an earlier date, and reads a flag-only end, an unknown period and no account', () => {
    const snapshot = toBillingSubscription(
      subscription({
        cancel_at: 1_763_000_000,
        trial_end: null,
        metadata: {},
        items: { object: 'list', data: [] } as unknown as Stripe.ApiList<Stripe.SubscriptionItem>,
      }),
    );
    const flagged = toBillingSubscription(
      subscription({
        cancel_at_period_end: true,
        items: {
          object: 'list',
          data: [{ current_period_end: 1_762_000_000, price: { recurring: { interval: 'week' } } }],
        } as unknown as Stripe.ApiList<Stripe.SubscriptionItem>,
      }),
    );

    expect(snapshot).toMatchObject({
      accountId: null,
      interval: null,
      trialEndsAt: null,
      currentPeriodEndsAt: null,
      cancelAtPeriodEnd: true,
    });
    expect(flagged).toMatchObject({ cancelAtPeriodEnd: true, interval: null });
    expect(
      toBillingSubscription(subscription({ customer: null as unknown as string })),
    ).toMatchObject({ customerId: '' });
  });
});

describe('StripeBillingGateway.parseEvent', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function signed(payload: object): { body: Buffer; signature: string } {
    const body = JSON.stringify(payload);
    return {
      body: Buffer.from(body),
      signature: Stripe.webhooks.generateTestHeaderString({
        payload: body,
        secret: WEBHOOK_SECRET,
      }),
    };
  }

  it('accepts an event signed with the webhook secret and keeps only its ids', () => {
    const { gateway } = setup();
    const { body, signature } = signed({
      id: 'evt_1',
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          object: 'checkout.session',
          subscription: 'sub_1',
          customer: 'cus_1',
          client_reference_id: ACCOUNT_ID,
        },
      },
    });

    expect(gateway.parseEvent(body, signature)).toEqual({
      id: 'evt_1',
      type: 'checkout.session.completed',
      subscriptionId: 'sub_1',
      customerId: 'cus_1',
      accountId: ACCOUNT_ID,
    });
  });

  it('refuses a missing or wrong signature, logging only the first line of the reason', () => {
    const warnings = quietLogs();
    const { gateway } = setup();
    const { body } = signed({
      id: 'evt_2',
      object: 'event',
      type: 'invoice.paid',
      data: { object: {} },
    });

    expect(() => gateway.parseEvent(body, null)).toThrow(InvalidBillingSignatureError);
    expect(() => gateway.parseEvent(body, 't=1,v1=bad')).toThrow(InvalidBillingSignatureError);
    expect(warnings).toEqual([expect.stringContaining('billing.signature_refused')]);
  });

  it('is unavailable without a webhook secret', () => {
    const fake = fakeStripe();
    const gateway = new StripeBillingGateway(fake.stripe, null);

    expect(() => gateway.parseEvent(Buffer.from('{}'), 't=1,v1=x')).toThrow(
      BillingUnavailableError,
    );
  });
});

describe('toBillingEvent', () => {
  function event(type: string, object: object): Stripe.Event {
    return { id: 'evt_1', object: 'event', type, data: { object } } as unknown as Stripe.Event;
  }

  it('reads the subscription, customer and account of each kind of event', () => {
    expect(
      toBillingEvent(event('customer.subscription.updated', subscription({ customer: 'cus_7' }))),
    ).toMatchObject({ subscriptionId: 'sub_1', customerId: 'cus_7', accountId: ACCOUNT_ID });
    expect(
      toBillingEvent(event('customer.subscription.deleted', subscription({ metadata: {} }))),
    ).toMatchObject({ accountId: null });
    expect(
      toBillingEvent(
        event('invoice.payment_failed', {
          customer: 'cus_3',
          parent: { subscription_details: { subscription: 'sub_3' } },
        }),
      ),
    ).toMatchObject({ subscriptionId: 'sub_3', customerId: 'cus_3', accountId: null });
    expect(
      toBillingEvent(event('invoice.paid', { customer: 'cus_4', parent: null })),
    ).toMatchObject({
      subscriptionId: null,
      customerId: 'cus_4',
    });
    expect(
      toBillingEvent(
        event('checkout.session.completed', {
          subscription: null,
          customer: null,
          client_reference_id: null,
        }),
      ),
    ).toMatchObject({ subscriptionId: null, customerId: null, accountId: null });
    expect(toBillingEvent(event('customer.created', {}))).toEqual({
      id: 'evt_1',
      type: 'customer.created',
      subscriptionId: null,
      customerId: null,
      accountId: null,
    });
  });
});
