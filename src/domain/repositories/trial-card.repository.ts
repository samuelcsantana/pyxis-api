import type { TrialCard } from '../billing/trial-card';

export interface TrialCardRepository {
  record(card: TrialCard): Promise<boolean>;
  otherAccountIds(fingerprint: string, accountId: string): Promise<readonly string[]>;
}

export const TRIAL_CARD_REPOSITORY = Symbol('TrialCardRepository');
