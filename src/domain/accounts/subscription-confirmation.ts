import type { BillingInterval } from '../billing/billing-gateway';
import type { AcceptedTerms } from './welcome';

export interface SubscriptionConfirmation {
  readonly interval: BillingInterval | null;
  readonly withdrawalDays: number;
  readonly terms: AcceptedTerms | null;
}
