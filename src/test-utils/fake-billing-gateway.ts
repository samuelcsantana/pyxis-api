import type { EmailLanguage } from '../domain/auth/email-language';
import type {
  BillingEvent,
  BillingGateway,
  BillingSubscription,
  CheckoutRequest,
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
  private readonly subscriptions = new Map<string, BillingSubscription>();
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

  parseEvent(): BillingEvent {
    if (this.nextEvent === null) {
      throw new InvalidBillingSignatureError();
    }
    return this.nextEvent;
  }
}
