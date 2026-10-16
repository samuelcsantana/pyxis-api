import { Logger } from '@nestjs/common';
import Stripe from 'stripe';
import type { CheckoutRequest } from '../../domain/billing/billing-gateway';
import {
  BillingUnavailableError,
  InvalidBillingSignatureError,
} from '../../domain/errors/billing.errors';
import { fakeStripe } from '../../test-utils/stripe-fake-http';
import {
  firstPaidInvoice,
  latestPaidInvoiceOf,
  paymentIntentOf,
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
      allow_promotion_codes: 'false',
      billing_address_collection: 'required',
      'tax_id_collection[enabled]': 'true',
      'consent_collection[terms_of_service]': 'required',
      'custom_text[submit][message]':
        'Um teste grátis por cliente. Depois dos 14 dias, a cobrança é automática; cancele ' +
        'quando quiser.',
      locale: 'pt-BR',
      success_url: CHECKOUT.successUrl,
      cancel_url: CHECKOUT.cancelUrl,
    });
  });

  it('lets the customer enter a promotion code when the switch is on', async () => {
    const fake = fakeStripe();
    const gateway = new StripeBillingGateway(fake.stripe, WEBHOOK_SECRET, {
      promotionCodes: true,
    });
    fake.answer('GET', '/v1/prices', { body: MONTHLY_PRICE });
    fake.answer('POST', '/v1/checkout/sessions', {
      body: { id: 'cs_3', object: 'checkout.session', url: 'https://checkout.stripe.com/c/3' },
    });

    await gateway.createCheckout(CHECKOUT);

    expect(fake.requests[1]?.form.get('allow_promotion_codes')).toBe('true');
    expect(fake.requests[1]?.form.get('subscription_data[trial_period_days]')).toBe('14');
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
    expect(requests[1]?.form.has('custom_text[submit][message]')).toBe(false);
    expect(requests[2]?.form.get('custom_text[submit][message]')).toContain(
      'One free trial per customer',
    );
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

  it('reads a subscription from Stripe, with its card expanded', async () => {
    const { gateway, answer, requests } = setup();
    answer('GET', '/v1/subscriptions/sub_1', {
      body: subscription({
        default_payment_method: {
          id: 'pm_1',
          object: 'payment_method',
          card: { fingerprint: 'fp_card_1' },
        } as Stripe.PaymentMethod,
      }),
    });

    expect(await gateway.subscription('sub_1')).toEqual({
      subscriptionId: 'sub_1',
      customerId: 'cus_1',
      accountId: ACCOUNT_ID,
      status: 'trialing',
      interval: 'month',
      trialEndsAt: new Date(1_762_000_000_000),
      currentPeriodEndsAt: new Date(1_762_000_000_000),
      cancelAtPeriodEnd: false,
      cardFingerprint: 'fp_card_1',
    });
    expect(requests[0]?.query.get('expand[0]')).toBe('default_payment_method');
  });
});

describe('StripeBillingGateway when an account is closed', () => {
  const PAID_AT = 1_762_000_000;
  const SINCE = new Date((PAID_AT - 3600) * 1000);

  function invoice(id: string, paidAt: number | null, amountPaid = 3900): object {
    return {
      id,
      object: 'invoice',
      amount_paid: amountPaid,
      status_transitions: { paid_at: paidAt },
    };
  }

  it('cancels the subscription at once', async () => {
    const { gateway, answer, requests } = setup();
    answer('DELETE', '/v1/subscriptions/sub_1', { body: subscription({ status: 'canceled' }) });

    await gateway.cancelSubscription('sub_1');

    expect(requests.map(({ method, path }) => `${method} ${path}`)).toEqual([
      'DELETE /v1/subscriptions/sub_1',
    ]);
  });

  it('refunds the first payment in full when it was made inside the window', async () => {
    const { gateway, answer, requests } = setup();
    answer('GET', '/v1/invoices', {
      body: {
        object: 'list',
        data: [
          invoice('in_2', PAID_AT + 2_600_000),
          invoice('in_1', PAID_AT),
          invoice('in_0', null, 0),
        ],
      },
    });
    answer('GET', '/v1/invoice_payments', {
      body: {
        object: 'list',
        data: [
          {
            id: 'inpay_1',
            object: 'invoice_payment',
            payment: { type: 'payment_intent', payment_intent: 'pi_1' },
          },
        ],
      },
    });
    answer('POST', '/v1/refunds', { body: { id: 're_1', object: 'refund' } });

    expect(await gateway.refundFirstPaymentSince('sub_1', SINCE)).toBe(3900);

    expect(requests[0]?.query.get('subscription')).toBe('sub_1');
    expect(requests[0]?.query.get('status')).toBe('paid');
    expect(requests[1]?.query.get('invoice')).toBe('in_1');
    expect(requests[2]?.form.get('payment_intent')).toBe('pi_1');
  });

  it('refunds nothing when the first payment is older than the window, or there is none', async () => {
    const old = setup();
    old.answer('GET', '/v1/invoices', {
      body: { object: 'list', data: [invoice('in_1', PAID_AT)] },
    });
    const none = setup();
    none.answer('GET', '/v1/invoices', { body: { object: 'list', data: [] } });

    expect(await old.gateway.refundFirstPaymentSince('sub_1', new Date((PAID_AT + 1) * 1000))).toBe(
      0,
    );
    expect(await none.gateway.refundFirstPaymentSince('sub_1', SINCE)).toBe(0);
    expect(old.requests).toHaveLength(1);
  });
});

describe('StripeBillingGateway when the operator closes an account', () => {
  const START = 1_762_000_000;
  const END = START + 30 * 24 * 60 * 60;

  function paidInvoice(id: string, paidAt: number, amountPaid = 3900): object {
    return {
      id,
      object: 'invoice',
      amount_paid: amountPaid,
      status_transitions: { paid_at: paidAt },
      lines: { object: 'list', data: [{ period: { start: START, end: END } }] },
    };
  }

  function payment(intent: string, amountPaid: number | null): object {
    return {
      id: `inpay_${intent}`,
      object: 'invoice_payment',
      amount_paid: amountPaid,
      payment: { type: 'payment_intent', payment_intent: intent },
    };
  }

  it("reads the subscription's latest paid invoice with its period", async () => {
    const { gateway, answer, requests } = setup();
    answer('GET', '/v1/invoices', {
      body: { object: 'list', data: [paidInvoice('in_1', START), paidInvoice('in_2', END)] },
    });

    await expect(gateway.latestPaidInvoice('sub_1')).resolves.toEqual({
      invoiceId: 'in_2',
      amountPaid: 3900,
      periodStart: new Date(START * 1000),
      periodEnd: new Date(END * 1000),
    });
    expect(requests[0]?.query.get('subscription')).toBe('sub_1');
    expect(requests[0]?.query.get('status')).toBe('paid');
  });

  it('refunds an amount from the payments of an invoice, never more than each one paid', async () => {
    const { gateway, answer, requests } = setup();
    answer('GET', '/v1/invoice_payments', {
      body: {
        object: 'list',
        data: [payment('pi_1', 1000), payment('pi_2', 3900), payment('pi_3', null)],
      },
    });
    answer('POST', '/v1/refunds', { body: { id: 're_1', object: 'refund' } });

    expect(await gateway.refundInvoice('in_2', 2600)).toBe(2600);

    expect(requests[0]?.query.get('invoice')).toBe('in_2');
    expect(
      requests.slice(1).map(({ form }) => [form.get('payment_intent'), form.get('amount')]),
    ).toEqual([
      ['pi_1', '1000'],
      ['pi_2', '1600'],
    ]);
  });
});

describe('the payments of an invoice', () => {
  it('finds the earliest paid invoice with money in it', () => {
    expect(
      firstPaidInvoice([
        { id: 'in_2', amount_paid: 3900, status_transitions: { paid_at: 20 } },
        { id: 'in_1', amount_paid: 3900, status_transitions: { paid_at: 10 } },
        { id: 'in_0', amount_paid: 0, status_transitions: { paid_at: 5 } },
        { id: 'in_open', amount_paid: 3900, status_transitions: { paid_at: null } },
      ] as unknown as Stripe.Invoice[]),
    ).toEqual({ id: 'in_1', paidAt: new Date(10_000), amountPaid: 3900 });
    expect(firstPaidInvoice([])).toBeNull();
  });

  it('finds the latest paid invoice with money and a period in it', () => {
    const line = { lines: { data: [{ period: { start: 1, end: 2 } }] } };
    const noLine = { lines: { data: [] } };

    expect(
      latestPaidInvoiceOf([
        { id: 'in_1', amount_paid: 3900, status_transitions: { paid_at: 10 }, ...line },
        { id: 'in_2', amount_paid: 3900, status_transitions: { paid_at: 20 }, ...line },
        { id: 'in_free', amount_paid: 0, status_transitions: { paid_at: 30 }, ...line },
        { id: 'in_open', amount_paid: 3900, status_transitions: { paid_at: null }, ...line },
        { id: 'in_bare', amount_paid: 3900, status_transitions: { paid_at: 40 }, ...noLine },
      ] as unknown as Stripe.Invoice[]),
    ).toEqual({
      invoiceId: 'in_2',
      amountPaid: 3900,
      periodStart: new Date(1000),
      periodEnd: new Date(2000),
    });
    expect(latestPaidInvoiceOf([])).toBeNull();
  });

  it('reads the payment intent of a card payment, given as an id or as an object', () => {
    const payment = (value: object) => ({ payment: value }) as unknown as Stripe.InvoicePayment;

    expect(paymentIntentOf(payment({ type: 'payment_intent', payment_intent: 'pi_1' }))).toEqual([
      'pi_1',
    ]);
    expect(
      paymentIntentOf(payment({ type: 'payment_intent', payment_intent: { id: 'pi_2' } })),
    ).toEqual(['pi_2']);
    expect(paymentIntentOf(payment({ type: 'payment_intent' }))).toEqual([]);
    expect(paymentIntentOf(payment({ type: 'charge', charge: 'ch_1' }))).toEqual([]);
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

  it('knows no card fingerprint without an expanded card payment method', () => {
    const fingerprintOf = (method: unknown) =>
      toBillingSubscription(
        subscription({ default_payment_method: method as Stripe.PaymentMethod | null }),
      ).cardFingerprint;

    expect(fingerprintOf(null)).toBeNull();
    expect(fingerprintOf('pm_not_expanded')).toBeNull();
    expect(fingerprintOf({ id: 'pm_pix', object: 'payment_method', type: 'pix' })).toBeNull();
    expect(
      fingerprintOf({ id: 'pm_2', object: 'payment_method', card: { fingerprint: null } }),
    ).toBeNull();
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
