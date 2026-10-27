import {
  ingestionPauseThresholdOf,
  type PlanAccount,
  type PlanLimits,
  planLimitsOf,
} from './account-limits';

export interface AcceptedTerms {
  readonly version: string;
  readonly url: string;
}

export type WelcomePlan =
  | { readonly kind: 'trial'; readonly trialEndsAt: Date }
  | { readonly kind: 'subscription' }
  | { readonly kind: 'free'; readonly limits: PlanLimits; readonly pauseAtEvents: number };

export interface Welcome {
  readonly plan: WelcomePlan;
  readonly terms: AcceptedTerms | null;
}

export function welcomePlanOf(
  account: PlanAccount & { readonly trialEndsAt: Date | null },
): WelcomePlan {
  if (account.status === 'free') {
    return {
      kind: 'free',
      limits: planLimitsOf(account),
      pauseAtEvents: ingestionPauseThresholdOf(account),
    };
  }
  if (account.status === 'trialing' && account.trialEndsAt !== null) {
    return { kind: 'trial', trialEndsAt: account.trialEndsAt };
  }
  return { kind: 'subscription' };
}
