import type { BillingSubscription } from './billing-gateway';

export interface TrialCard {
  readonly fingerprint: string;
  readonly accountId: string;
  readonly trialStartedAt: Date;
}

export function trialCardOf(
  accountId: string,
  subscription: BillingSubscription,
  at: Date,
): TrialCard | null {
  const fingerprint = subscription.cardFingerprint;
  if (subscription.trialEndsAt === null || fingerprint === null) {
    return null;
  }
  return { fingerprint, accountId, trialStartedAt: at };
}
