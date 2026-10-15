import type { AccountStatus } from '../accounts/account-status';
import type { BillingInterval } from '../billing/billing-gateway';

export interface Account {
  readonly id: string;
  readonly ownerAdminId: string;
  readonly status: AccountStatus;
  readonly ingestionPausedUntil: Date | null;
  readonly stripeCustomerId: string | null;
  readonly billingInterval: BillingInterval | null;
  readonly trialEndsAt: Date | null;
  readonly currentPeriodEndsAt: Date | null;
  readonly accessEndsAt: Date | null;
  readonly suspendedAt: Date | null;
  readonly suspensionReason: string | null;
  readonly createdAt: Date;
}
