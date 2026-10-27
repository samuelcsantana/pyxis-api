import type { EmailLanguage } from '../auth/email-language';
import type { BillingInterval } from '../billing/billing-gateway';

export interface SubscriptionConfirmationTarget {
  readonly accountId: string;
  readonly ownerEmail: string;
  readonly ownerLanguage: EmailLanguage;
  readonly billingInterval: BillingInterval | null;
  readonly termsVersion: string | null;
}

export interface SubscriptionConfirmationRepository {
  toConfirm(accountId: string): Promise<SubscriptionConfirmationTarget | null>;
  pendingConfirmations(): Promise<readonly SubscriptionConfirmationTarget[]>;
  markConfirmed(accountId: string): Promise<void>;
}

export const SUBSCRIPTION_CONFIRMATION_REPOSITORY = Symbol('SubscriptionConfirmationRepository');
