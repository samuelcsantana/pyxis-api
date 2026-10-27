import { type AccountStatus, hasAccess, hasRunningSubscription } from '../accounts/account-status';
import { monthLabelOf } from '../queries/project-usage';
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
  readonly leavesFreePlan: LeftFreePlan | null;
}

export interface LeftFreePlan {
  readonly at: Date;
  readonly month: string;
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

export function keepsTheFreePlan(
  subscription: BillingSubscription,
  current: AccountBillingState,
): boolean {
  return current.status === 'free' && !hasAccess(statusFor(subscription));
}

export function endsARunningSubscription(
  current: AccountBillingState,
  update: AccountBillingUpdate,
): boolean {
  return update.status === 'ended' && hasRunningSubscription(current.status);
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
    leavesFreePlan:
      current.status === 'free' && hasRunningSubscription(status)
        ? { at: now, month: monthLabelOf(now) }
        : null,
  };
}
