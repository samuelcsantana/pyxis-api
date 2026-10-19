import { Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { PRICE_LOOKUP_KEYS } from '../../domain/accounts/hosted-plan';
import type { EmailLanguage } from '../../domain/auth/email-language';
import {
  BILLING_INTERVALS,
  type BillingEvent,
  type BillingGateway,
  type BillingInterval,
  type BillingSubscription,
  type CheckoutRequest,
  type PaidInvoice,
} from '../../domain/billing/billing-gateway';
import {
  BillingUnavailableError,
  InvalidBillingSignatureError,
} from '../../domain/errors/billing.errors';
import { trialNotice } from './trial-notice';

const MILLISECONDS_PER_SECOND = 1000;
const ACCOUNT_ID_METADATA = 'account_id';
const SUBSCRIPTION_EXPANSIONS = ['default_payment_method'];

export interface CheckoutOptions {
  readonly promotionCodes: boolean;
}

const WITHOUT_PROMOTION_CODES: CheckoutOptions = { promotionCodes: false };

const STRIPE_LOCALES: Readonly<Record<EmailLanguage, Stripe.Checkout.SessionCreateParams.Locale>> =
  {
    en: 'en',
    'pt-BR': 'pt-BR',
    es: 'es',
    de: 'de',
    fr: 'fr',
    it: 'it',
    nl: 'nl',
  };

type ExpandableId = string | { readonly id: string } | null;

function idOf(value: ExpandableId): string | null {
  if (value === null) {
    return null;
  }
  return typeof value === 'string' ? value : value.id;
}

function fromUnixSeconds(value: number | null | undefined): Date | null {
  return value === null || value === undefined ? null : new Date(value * MILLISECONDS_PER_SECOND);
}

function intervalOf(subscription: Stripe.Subscription): BillingInterval | null {
  const interval = subscription.items.data[0]?.price.recurring?.interval;
  return BILLING_INTERVALS.find((known) => known === interval) ?? null;
}

function cardFingerprintOf(subscription: Stripe.Subscription): string | null {
  const method = subscription.default_payment_method;
  return method !== null && typeof method === 'object' ? (method.card?.fingerprint ?? null) : null;
}

export function toBillingSubscription(subscription: Stripe.Subscription): BillingSubscription {
  const endsAt = fromUnixSeconds(subscription.cancel_at);
  const clampedToEnd = (date: Date | null): Date | null =>
    date !== null && endsAt !== null && endsAt < date ? endsAt : date;
  return {
    subscriptionId: subscription.id,
    customerId: idOf(subscription.customer) ?? '',
    accountId: subscription.metadata[ACCOUNT_ID_METADATA] ?? null,
    status: subscription.status,
    interval: intervalOf(subscription),
    trialEndsAt: clampedToEnd(fromUnixSeconds(subscription.trial_end)),
    currentPeriodEndsAt: clampedToEnd(
      fromUnixSeconds(subscription.items.data[0]?.current_period_end),
    ),
    cancelAtPeriodEnd: subscription.cancel_at_period_end || endsAt !== null,
    cardFingerprint: cardFingerprintOf(subscription),
  };
}

export function toBillingEvent(event: Stripe.Event): BillingEvent {
  const base = { id: event.id, type: event.type };
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    return {
      ...base,
      subscriptionId: idOf(session.subscription),
      customerId: idOf(session.customer),
      accountId: session.client_reference_id,
    };
  }
  if (event.type.startsWith('customer.subscription.')) {
    const subscription = event.data.object as Stripe.Subscription;
    return {
      ...base,
      subscriptionId: subscription.id,
      customerId: idOf(subscription.customer),
      accountId: subscription.metadata[ACCOUNT_ID_METADATA] ?? null,
    };
  }
  if (event.type.startsWith('invoice.')) {
    const invoice = event.data.object as Stripe.Invoice;
    return {
      ...base,
      subscriptionId: idOf(invoice.parent?.subscription_details?.subscription ?? null),
      customerId: idOf(invoice.customer),
      accountId: null,
    };
  }
  return { ...base, subscriptionId: null, customerId: null, accountId: null };
}

function firstLine(error: unknown): string {
  return String(error).split('\n', 1).join('');
}

const INVOICE_PAGE = 100;
const SECOND_MS = 1000;

interface FirstPaidInvoice {
  readonly id: string;
  readonly paidAt: Date;
  readonly amountPaid: number;
}

export function firstPaidInvoice(invoices: readonly Stripe.Invoice[]): FirstPaidInvoice | null {
  const paid = invoices.flatMap((invoice) => {
    const paidAt = invoice.status_transitions.paid_at;
    return invoice.amount_paid > 0 && paidAt !== null
      ? [{ id: invoice.id, paidAt: new Date(paidAt * SECOND_MS), amountPaid: invoice.amount_paid }]
      : [];
  });
  return paid.sort((left, right) => left.paidAt.getTime() - right.paidAt.getTime())[0] ?? null;
}

export function latestPaidInvoiceOf(invoices: readonly Stripe.Invoice[]): PaidInvoice | null {
  const paid = invoices.flatMap((invoice) => {
    const paidAt = invoice.status_transitions.paid_at;
    const period = invoice.lines.data[0]?.period;
    return invoice.amount_paid > 0 && paidAt !== null && period !== undefined
      ? [
          {
            paidAt,
            invoice: {
              invoiceId: invoice.id,
              amountPaid: invoice.amount_paid,
              periodStart: new Date(period.start * SECOND_MS),
              periodEnd: new Date(period.end * SECOND_MS),
            },
          },
        ]
      : [];
  });
  return paid.sort((left, right) => right.paidAt - left.paidAt)[0]?.invoice ?? null;
}

export function paymentIntentOf(payment: Stripe.InvoicePayment): string[] {
  const intent = payment.payment.payment_intent;
  if (payment.payment.type !== 'payment_intent' || intent === undefined) {
    return [];
  }
  return [typeof intent === 'string' ? intent : intent.id];
}

export class StripeBillingGateway implements BillingGateway {
  private readonly logger = new Logger(StripeBillingGateway.name);
  private readonly prices = new Map<BillingInterval, string>();

  constructor(
    private readonly stripe: Stripe,
    private readonly webhookSecret: string | null,
    private readonly checkoutOptions: CheckoutOptions = WITHOUT_PROMOTION_CODES,
  ) {}

  async createCheckout(request: CheckoutRequest): Promise<{ readonly url: string }> {
    const price = await this.priceFor(request.interval);
    const session = await this.call('checkout.sessions.create', () =>
      this.stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price, quantity: 1 }],
        ...(request.customerId === null
          ? { customer_email: request.customerEmail }
          : { customer: request.customerId }),
        client_reference_id: request.accountId,
        subscription_data: {
          ...(request.trialDays === null ? {} : { trial_period_days: request.trialDays }),
          metadata: { [ACCOUNT_ID_METADATA]: request.accountId },
        },
        payment_method_collection: 'always',
        allow_promotion_codes: this.checkoutOptions.promotionCodes,
        billing_address_collection: 'required',
        tax_id_collection: { enabled: true },
        consent_collection: { terms_of_service: 'required' },
        ...(request.trialDays === null
          ? {}
          : {
              custom_text: {
                submit: { message: trialNotice(request.language, request.trialDays) },
              },
            }),
        locale: STRIPE_LOCALES[request.language],
        success_url: request.successUrl,
        cancel_url: request.cancelUrl,
      }),
    );
    if (session.url === null) {
      throw new BillingUnavailableError('checkout.sessions.create answered without a URL');
    }
    return { url: session.url };
  }

  async createPortal(
    customerId: string,
    returnUrl: string,
    language: EmailLanguage,
  ): Promise<{ readonly url: string }> {
    const session = await this.call('billingPortal.sessions.create', () =>
      this.stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
        locale: STRIPE_LOCALES[language],
      }),
    );
    return { url: session.url };
  }

  async subscription(subscriptionId: string): Promise<BillingSubscription> {
    const subscription = await this.call('subscriptions.retrieve', () =>
      this.stripe.subscriptions.retrieve(subscriptionId, { expand: SUBSCRIPTION_EXPANSIONS }),
    );
    return toBillingSubscription(subscription);
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    await this.call('subscriptions.cancel', () => this.stripe.subscriptions.cancel(subscriptionId));
  }

  async refundFirstPaymentSince(subscriptionId: string, since: Date): Promise<number> {
    const invoices = await this.call('invoices.list', () =>
      this.stripe.invoices.list({
        subscription: subscriptionId,
        status: 'paid',
        limit: INVOICE_PAGE,
      }),
    );
    const first = firstPaidInvoice(invoices.data);
    if (first === null || first.paidAt < since) {
      return 0;
    }
    const payments = await this.call('invoicePayments.list', () =>
      this.stripe.invoicePayments.list({ invoice: first.id, status: 'paid' }),
    );
    for (const paymentIntent of payments.data.flatMap(paymentIntentOf)) {
      await this.call('refunds.create', () =>
        this.stripe.refunds.create({ payment_intent: paymentIntent }),
      );
    }
    return first.amountPaid;
  }

  async latestPaidInvoice(subscriptionId: string): Promise<PaidInvoice | null> {
    const invoices = await this.call('invoices.list', () =>
      this.stripe.invoices.list({
        subscription: subscriptionId,
        status: 'paid',
        limit: INVOICE_PAGE,
      }),
    );
    return latestPaidInvoiceOf(invoices.data);
  }

  async refundInvoice(invoiceId: string, amount: number): Promise<number> {
    const payments = await this.call('invoicePayments.list', () =>
      this.stripe.invoicePayments.list({ invoice: invoiceId, status: 'paid' }),
    );
    let refunded = 0;
    for (const payment of payments.data) {
      const share = Math.min(amount - refunded, payment.amount_paid ?? 0);
      for (const paymentIntent of share > 0 ? paymentIntentOf(payment) : []) {
        await this.call('refunds.create', () =>
          this.stripe.refunds.create({ payment_intent: paymentIntent, amount: share }),
        );
        refunded += share;
      }
    }
    return refunded;
  }

  parseEvent(rawBody: Buffer, signature: string | null): BillingEvent {
    if (this.webhookSecret === null) {
      throw new BillingUnavailableError('STRIPE_WEBHOOK_SECRET is not set');
    }
    if (signature === null) {
      throw new InvalidBillingSignatureError();
    }
    try {
      return toBillingEvent(
        this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret),
      );
    } catch (error) {
      this.logger.warn({ message: 'billing.signature_refused', reason: firstLine(error) });
      throw new InvalidBillingSignatureError();
    }
  }

  private async priceFor(interval: BillingInterval): Promise<string> {
    const known = this.prices.get(interval);
    if (known !== undefined) {
      return known;
    }
    const lookupKey = PRICE_LOOKUP_KEYS[interval];
    const page = await this.call('prices.list', () =>
      this.stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 }),
    );
    const price = page.data[0]?.id;
    if (price === undefined) {
      throw new BillingUnavailableError(`no active price has the lookup key ${lookupKey}`);
    }
    this.prices.set(interval, price);
    return price;
  }

  private async call<Result>(operation: string, request: () => Promise<Result>): Promise<Result> {
    try {
      return await request();
    } catch (error) {
      const code = error instanceof Stripe.errors.StripeError ? error.code : undefined;
      this.logger.warn({
        message: 'billing.request_failed',
        operation,
        code: code ?? 'unknown',
        reason: firstLine(error),
      });
      throw new BillingUnavailableError(`${operation} failed`);
    }
  }
}
