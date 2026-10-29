import { Logger } from '@nestjs/common';
import { SESSION_ABSOLUTE_TTL_MS, SESSION_IDLE_TTL_MS } from '../../domain/auth/session-policy';
import {
  FINISHED_AUTHORIZATION_REQUEST_RETENTION_DAYS,
  idleConnectionCutoff,
  later,
  SPENT_REFRESH_TOKEN_RETENTION_DAYS,
} from '../../domain/oauth/oauth-policy';
import {
  eventRetentionCutoff,
  RETENTION_BATCH_SIZE,
  trialCardRetentionCutoff,
} from '../../domain/retention/retention-policy';
import type { RetentionRepository } from '../../domain/retention/retention.repository';
import type { Clock } from '../../domain/services/clock';

export const RETENTION_STEPS = [
  'events',
  'cities',
  'sessions',
  'signInCodes',
  'trialCards',
  'oauthConnections',
  'oauthTokens',
  'oauthRequests',
] as const;
export type RetentionStep = (typeof RETENTION_STEPS)[number];

export type RetentionReport = Readonly<Record<RetentionStep, number>>;

const MILLISECONDS_PER_DAY = 86_400_000;

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
      cities: () => this.eraseCitiesTurnedOff(),
      sessions: () =>
        this.retention.deleteExpiredSessions({
          createdBefore: new Date(now.getTime() - SESSION_ABSOLUTE_TTL_MS),
          lastUsedBefore: new Date(now.getTime() - SESSION_IDLE_TTL_MS),
        }),
      signInCodes: () => this.retention.deleteExpiredSignInCodes(now),
      trialCards: () => this.retention.deleteTrialCardsStartedBefore(trialCardRetentionCutoff(now)),
      oauthConnections: () => this.retention.deleteEndedConnections(idleConnectionCutoff(now)),
      oauthTokens: () =>
        this.retention.deleteSpentConnectionTokens({
          expiredBefore: now,
          rotatedBefore: later(now, -SPENT_REFRESH_TOKEN_RETENTION_DAYS * MILLISECONDS_PER_DAY),
        }),
      oauthRequests: () =>
        this.retention.deleteFinishedAuthorizationRequests(
          later(now, -FINISHED_AUTHORIZATION_REQUEST_RETENTION_DAYS * MILLISECONDS_PER_DAY),
        ),
    };
    const report: Record<RetentionStep, number> = {
      events: 0,
      cities: 0,
      sessions: 0,
      signInCodes: 0,
      trialCards: 0,
      oauthConnections: 0,
      oauthTokens: 0,
      oauthRequests: 0,
    };
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
    return inBatches(await this.retention.projectIdsNotHeld(), (projectId) =>
      this.retention.deleteEventsBefore(projectId, cutoff, RETENTION_BATCH_SIZE),
    );
  }

  private async eraseCitiesTurnedOff(): Promise<number> {
    return inBatches(await this.retention.projectIdsWithCitiesToErase(), (projectId) =>
      this.retention.eraseCities(projectId, RETENTION_BATCH_SIZE),
    );
  }
}

async function inBatches(
  projectIds: readonly string[],
  nextBatch: (projectId: string) => Promise<number>,
): Promise<number> {
  let total = 0;
  for (const projectId of projectIds) {
    let changed: number;
    do {
      changed = await nextBatch(projectId);
      total += changed;
    } while (changed === RETENTION_BATCH_SIZE);
  }
  return total;
}
