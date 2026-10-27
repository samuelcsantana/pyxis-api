import type { EmailLanguage } from '../domain/auth/email-language';
import type {
  BillingEvent,
  BillingGateway,
  BillingSubscription,
  CheckoutRequest,
  PaidInvoice,
} from '../domain/billing/billing-gateway';
import {
  BillingUnavailableError,
  InvalidBillingSignatureError,
} from '../domain/errors/billing.errors';

export interface OpenedPortal {
  readonly customerId: string;
  readonly returnUrl: string;
  readonly language: EmailLanguage;
}

export class FakeBillingGateway implements BillingGateway {
  readonly checkouts: CheckoutRequest[] = [];
  readonly portals: OpenedPortal[] = [];
  readonly subscriptionReads: string[] = [];
  readonly cancelled: string[] = [];
  readonly refunds: { readonly subscriptionId: string; readonly since: Date }[] = [];
  refundAmount = 0;
  latestInvoice: PaidInvoice | null = null;
  readonly invoiceRefunds: { readonly invoiceId: string; readonly amount: number }[] = [];
  cancelFailure: Error | null = null;
  refundFailure: Error | null = null;
  private readonly subscriptions = new Map<string, BillingSubscription>();
  private readonly firstPayments = new Map<string, Date>();
  private nextEvent: BillingEvent | null = null;

  addSubscription(subscription: BillingSubscription): void {
    this.subscriptions.set(subscription.subscriptionId, subscription);
  }

  willReceive(event: BillingEvent): void {
    this.nextEvent = event;
  }

  createCheckout(request: CheckoutRequest): Promise<{ readonly url: string }> {
    this.checkouts.push(request);
    return Promise.resolve({ url: `https://checkout.example.com/${request.accountId}` });
  }

  createPortal(
    customerId: string,
    returnUrl: string,
    language: EmailLanguage,
  ): Promise<{ readonly url: string }> {
    this.portals.push({ customerId, returnUrl, language });
    return Promise.resolve({ url: `https://portal.example.com/${customerId}` });
  }

  subscription(subscriptionId: string): Promise<BillingSubscription> {
    this.subscriptionReads.push(subscriptionId);
    const subscription = this.subscriptions.get(subscriptionId);
    return subscription === undefined
      ? Promise.reject(new BillingUnavailableError('subscriptions.retrieve failed'))
      : Promise.resolve(subscription);
  }

  cancelSubscription(subscriptionId: string): Promise<void> {
    if (this.cancelFailure !== null) {
      return Promise.reject(this.cancelFailure);
    }
    this.cancelled.push(subscriptionId);
    return Promise.resolve();
  }

  firstPaymentAt(subscriptionId: string): Promise<Date | null> {
    return Promise.resolve(this.firstPayments.get(subscriptionId) ?? null);
  }

  paidFirstOn(subscriptionId: string, at: Date): void {
    this.firstPayments.set(subscriptionId, at);
  }

  refundFirstPaymentSince(subscriptionId: string, since: Date): Promise<number> {
    if (this.refundFailure !== null) {
      return Promise.reject(this.refundFailure);
    }
    this.refunds.push({ subscriptionId, since });
    return Promise.resolve(this.refundAmount);
  }

  latestPaidInvoice(): Promise<PaidInvoice | null> {
    return Promise.resolve(this.latestInvoice);
  }

  refundInvoice(invoiceId: string, amount: number): Promise<number> {
    if (this.refundFailure !== null) {
      return Promise.reject(this.refundFailure);
    }
    this.invoiceRefunds.push({ invoiceId, amount });
    return Promise.resolve(amount);
  }

  parseEvent(): BillingEvent {
    if (this.nextEvent === null) {
      throw new InvalidBillingSignatureError();
    }
    return this.nextEvent;
  }
}
