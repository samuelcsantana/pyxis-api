import type { EmailLanguage } from '../auth/email-language';

export const BILLING_INTERVALS = ['month', 'year'] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export interface CheckoutRequest {
  readonly accountId: string;
  readonly customerId: string | null;
  readonly customerEmail: string;
  readonly interval: BillingInterval;
  readonly language: EmailLanguage;
  readonly trialDays: number | null;
  readonly successUrl: string;
  readonly cancelUrl: string;
}

export interface BillingSubscription {
  readonly subscriptionId: string;
  readonly customerId: string;
  readonly accountId: string | null;
  readonly status: string;
  readonly interval: BillingInterval | null;
  readonly trialEndsAt: Date | null;
  readonly currentPeriodEndsAt: Date | null;
  readonly cancelAtPeriodEnd: boolean;
}

export interface BillingEvent {
  readonly id: string;
  readonly type: string;
  readonly subscriptionId: string | null;
  readonly customerId: string | null;
  readonly accountId: string | null;
}

export interface BillingGateway {
  createCheckout(request: CheckoutRequest): Promise<{ readonly url: string }>;
  createPortal(
    customerId: string,
    returnUrl: string,
    language: EmailLanguage,
  ): Promise<{ readonly url: string }>;
  subscription(subscriptionId: string): Promise<BillingSubscription>;
  parseEvent(rawBody: Buffer, signature: string | null): BillingEvent;
}

export const BILLING_GATEWAY = Symbol('BillingGateway');
