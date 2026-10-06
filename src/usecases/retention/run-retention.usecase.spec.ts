import { Logger } from '@nestjs/common';
import { RETENTION_BATCH_SIZE } from '../../domain/retention/retention-policy';
import type {
  ExpiredSessionCutoffs,
  RetentionRepository,
} from '../../domain/retention/retention.repository';
import { FixedClock } from '../../test-utils/fixed-clock';
import { RetentionFailedError, RunRetentionUseCase } from './run-retention.usecase';

const NOW = new Date('2026-10-06T06:00:00.000Z');

class ScriptedRetention implements RetentionRepository {
  readonly eventCalls: { readonly projectId: string; readonly cutoff: Date }[] = [];
  readonly sessionCutoffs: ExpiredSessionCutoffs[] = [];
  readonly codeNows: Date[] = [];
  failing: string | null = null;

  constructor(private readonly batches: Readonly<Record<string, number[]>>) {}

  projectIds(): Promise<readonly string[]> {
    return Promise.resolve(Object.keys(this.batches));
  }

  deleteEventsBefore(projectId: string, cutoff: Date, limit: number): Promise<number> {
    if (this.failing === 'events') {
      return Promise.reject(new Error('lock timeout'));
    }
    this.eventCalls.push({ projectId, cutoff });
    const next = this.batches[projectId]?.shift() ?? 0;
    return Promise.resolve(Math.min(next, limit));
  }

  deleteExpiredSessions(cutoffs: ExpiredSessionCutoffs): Promise<number> {
    this.sessionCutoffs.push(cutoffs);
    return Promise.resolve(3);
  }

  deleteExpiredSignInCodes(now: Date): Promise<number> {
    this.codeNows.push(now);
    return Promise.resolve(5);
  }
}

describe('RunRetentionUseCase', () => {
  let logs: { level: string; message: unknown }[];

  beforeEach(() => {
    logs = [];
    jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      logs.push({ level: 'log', message });
    });
    jest.spyOn(Logger.prototype, 'error').mockImplementation((message: unknown) => {
      logs.push({ level: 'error', message });
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('deletes old events project by project, batch after batch, until a batch comes back short', async () => {
    const retention = new ScriptedRetention({
      'project-a': [RETENTION_BATCH_SIZE, RETENTION_BATCH_SIZE, 7],
      'project-b': [0],
    });

    const report = await new RunRetentionUseCase(retention, new FixedClock(NOW)).execute();

    expect(report).toEqual({
      events: RETENTION_BATCH_SIZE * 2 + 7,
      sessions: 3,
      signInCodes: 5,
    });
    expect(retention.eventCalls.map((call) => call.projectId)).toEqual([
      'project-a',
      'project-a',
      'project-a',
      'project-b',
    ]);
    expect(retention.eventCalls[0]?.cutoff).toEqual(new Date('2025-09-06T06:00:00.000Z'));
    expect(retention.sessionCutoffs).toEqual([
      {
        createdBefore: new Date('2026-09-29T06:00:00.000Z'),
        lastUsedBefore: new Date('2026-10-05T06:00:00.000Z'),
      },
    ]);
    expect(retention.codeNows).toEqual([NOW]);
    expect(logs).toContainEqual({
      level: 'log',
      message: { message: 'retention.step_done', step: 'signInCodes', deleted: 5 },
    });
  });

  it('runs every step even when one fails, then fails with the steps that did', async () => {
    const retention = new ScriptedRetention({ 'project-a': [1] });
    retention.failing = 'events';

    await expect(new RunRetentionUseCase(retention, new FixedClock(NOW)).execute()).rejects.toEqual(
      new RetentionFailedError(['events']),
    );
    expect(retention.sessionCutoffs).toHaveLength(1);
    expect(retention.codeNows).toHaveLength(1);
    expect(logs).toContainEqual({
      level: 'error',
      message: { message: 'retention.step_failed', step: 'events', error: 'lock timeout' },
    });
  });

  it('logs a failure that is not an Error as text', async () => {
    const retention = new ScriptedRetention({});
    jest.spyOn(retention, 'deleteExpiredSessions').mockRejectedValue('connection reset');

    await expect(
      new RunRetentionUseCase(retention, new FixedClock(NOW)).execute(),
    ).rejects.toMatchObject({
      failedSteps: ['sessions'],
      message: 'Retention failed at: sessions.',
    });
    expect(logs).toContainEqual({
      level: 'error',
      message: { message: 'retention.step_failed', step: 'sessions', error: 'connection reset' },
    });
  });
});
