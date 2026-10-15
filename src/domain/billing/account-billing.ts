import { type AccountStatus, hasAccess } from '../accounts/account-status';
import type { BillingInterval, BillingSubscription } from './billing-gateway';

export interface AccountBillingState {
  readonly accountId: string;
  readonly status: AccountStatus;
  readonly accessEndsAt: Date | null;
}

export interface AccountBillingUpdate {
  readonly status: AccountStatus;
  readonly stripeCustomerId: string;
  readonly stripeSubscriptionId: string;
  readonly billingInterval: BillingInterval | null;
  readonly trialEndsAt: Date | null;
  readonly currentPeriodEndsAt: Date | null;
  readonly accessEndsAt: Date | null;
  readonly restoresAccess: boolean;
}

const RUNNING_STATUSES: ReadonlySet<string> = new Set(['trialing', 'active']);

function statusFor(subscription: BillingSubscription): AccountStatus {
  if (RUNNING_STATUSES.has(subscription.status)) {
    if (subscription.cancelAtPeriodEnd) {
      return 'ending';
    }
    return subscription.status === 'trialing' ? 'trialing' : 'active';
  }
  if (subscription.status === 'past_due') {
    return 'past_due';
  }
  return subscription.status === 'incomplete' ? 'incomplete' : 'ended';
}

function scheduledEndOf(subscription: BillingSubscription): Date | null {
  return subscription.status === 'trialing'
    ? subscription.trialEndsAt
    : subscription.currentPeriodEndsAt;
}

function accessEndFor(
  status: AccountStatus,
  subscription: BillingSubscription,
  current: AccountBillingState,
  now: Date,
): Date | null {
  if (status === 'ending') {
    return scheduledEndOf(subscription);
  }
  if (status === 'ended') {
    return current.accessEndsAt ?? now;
  }
  return null;
}

export function billingUpdateFor(
  subscription: BillingSubscription,
  current: AccountBillingState,
  now: Date,
): AccountBillingUpdate {
  const status = statusFor(subscription);
  return {
    status,
    stripeCustomerId: subscription.customerId,
    stripeSubscriptionId: subscription.subscriptionId,
    billingInterval: subscription.interval,
    trialEndsAt: subscription.trialEndsAt,
    currentPeriodEndsAt: subscription.currentPeriodEndsAt,
    accessEndsAt: accessEndFor(status, subscription, current, now),
    restoresAccess: hasAccess(status),
  };
}
