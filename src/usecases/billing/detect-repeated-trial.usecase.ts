import { Inject, Injectable, Logger } from '@nestjs/common';
import type { BillingSubscription } from '../../domain/billing/billing-gateway';
import { trialCardOf } from '../../domain/billing/trial-card';
import {
  TRIAL_CARD_REPOSITORY,
  type TrialCardRepository,
} from '../../domain/repositories/trial-card.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';

@Injectable()
export class DetectRepeatedTrialUseCase {
  private readonly logger = new Logger(DetectRepeatedTrialUseCase.name);

  constructor(
    @Inject(TRIAL_CARD_REPOSITORY) private readonly trialCards: TrialCardRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async tryDetect(accountId: string, subscription: BillingSubscription): Promise<void> {
    const card = trialCardOf(accountId, subscription, this.clock.now());
    if (card === null) {
      return;
    }
    try {
      if (!(await this.trialCards.record(card))) {
        return;
      }
      const earlierAccountIds = await this.trialCards.otherAccountIds(card.fingerprint, accountId);
      if (earlierAccountIds.length > 0) {
        this.logger.warn({ message: 'billing.repeated_trial', accountId, earlierAccountIds });
      }
    } catch (error) {
      this.logger.error({
        message: 'billing.repeated_trial_check_failed',
        accountId,
        reason: String(error),
      });
    }
  }
}
