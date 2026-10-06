import { Logger } from '@nestjs/common';
import { SESSION_ABSOLUTE_TTL_MS, SESSION_IDLE_TTL_MS } from '../../domain/auth/session-policy';
import {
  eventRetentionCutoff,
  RETENTION_BATCH_SIZE,
} from '../../domain/retention/retention-policy';
import type { RetentionRepository } from '../../domain/retention/retention.repository';
import type { Clock } from '../../domain/services/clock';

export const RETENTION_STEPS = ['events', 'sessions', 'signInCodes'] as const;
export type RetentionStep = (typeof RETENTION_STEPS)[number];

export type RetentionReport = Readonly<Record<RetentionStep, number>>;

export class RetentionFailedError extends Error {
  constructor(readonly failedSteps: readonly RetentionStep[]) {
    super(`Retention failed at: ${failedSteps.join(', ')}.`);
    this.name = 'RetentionFailedError';
  }
}

export class RunRetentionUseCase {
  private readonly logger = new Logger(RunRetentionUseCase.name);

  constructor(
    private readonly retention: RetentionRepository,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<RetentionReport> {
    const now = this.clock.now();
    const steps: Readonly<Record<RetentionStep, () => Promise<number>>> = {
      events: () => this.deleteOldEvents(eventRetentionCutoff(now)),
      sessions: () =>
        this.retention.deleteExpiredSessions({
          createdBefore: new Date(now.getTime() - SESSION_ABSOLUTE_TTL_MS),
          lastUsedBefore: new Date(now.getTime() - SESSION_IDLE_TTL_MS),
        }),
      signInCodes: () => this.retention.deleteExpiredSignInCodes(now),
    };
    const report: Record<RetentionStep, number> = { events: 0, sessions: 0, signInCodes: 0 };
    const failed: RetentionStep[] = [];
    for (const step of RETENTION_STEPS) {
      try {
        report[step] = await steps[step]();
        this.logger.log({ message: 'retention.step_done', step, deleted: report[step] });
      } catch (error) {
        failed.push(step);
        this.logger.error({
          message: 'retention.step_failed',
          step,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    if (failed.length > 0) {
      throw new RetentionFailedError(failed);
    }
    return report;
  }

  private async deleteOldEvents(cutoff: Date): Promise<number> {
    let total = 0;
    for (const projectId of await this.retention.projectIds()) {
      let deleted: number;
      do {
        deleted = await this.retention.deleteEventsBefore(projectId, cutoff, RETENTION_BATCH_SIZE);
        total += deleted;
      } while (deleted === RETENTION_BATCH_SIZE);
    }
    return total;
  }
}
