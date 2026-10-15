import type { TrialCard } from '../domain/billing/trial-card';
import type { TrialCardRepository } from '../domain/repositories/trial-card.repository';

export class InMemoryTrialCardRepository implements TrialCardRepository {
  readonly cards: TrialCard[] = [];

  record(card: TrialCard): Promise<boolean> {
    const known = this.cards.some(
      (stored) => stored.fingerprint === card.fingerprint && stored.accountId === card.accountId,
    );
    if (!known) {
      this.cards.push(card);
    }
    return Promise.resolve(!known);
  }

  otherAccountIds(fingerprint: string, accountId: string): Promise<readonly string[]> {
    return Promise.resolve(
      this.cards
        .filter((card) => card.fingerprint === fingerprint && card.accountId !== accountId)
        .sort((left, right) => left.trialStartedAt.getTime() - right.trialStartedAt.getTime())
        .map((card) => card.accountId),
    );
  }
}
