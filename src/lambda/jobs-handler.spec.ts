import { createJobsHandler, type JobsHandlerDependencies } from './jobs-handler';

const SIZE = { bytes: 300_000_000, limitBytes: 1_000_000_000, ratio: 0.3 };
const RETENTION = { events: 12, sessions: 1, signInCodes: 2 };
const DIGEST = { sent: 2, alreadySent: 1, failed: 0 };

function recordingDependencies(order: string[]): JobsHandlerDependencies {
  return {
    loadParameters: () => {
      order.push('parameters');
      return Promise.resolve();
    },
    reportDatabaseSize: () => {
      order.push('size');
      return Promise.resolve(SIZE);
    },
    runRetention: () => {
      order.push('retention');
      return Promise.resolve(RETENTION);
    },
    sendWeeklyDigests: () => {
      order.push('digest');
      return Promise.resolve(DIGEST);
    },
  };
}

describe('createJobsHandler', () => {
  it.each([
    ['no event', undefined],
    ['the daily schedule event', {}],
    ['an unknown job', { job: 'monthly-report' }],
    ['an event that is not an object', 'weekly-digest'],
    ['null', null],
  ])('runs the daily jobs for %s: parameters, database size, retention', async (_label, event) => {
    const order: string[] = [];

    await expect(createJobsHandler(recordingDependencies(order))(event)).resolves.toEqual({
      ok: true,
      job: 'daily',
      databaseSize: SIZE,
      retention: RETENTION,
    });
    expect(order).toEqual(['parameters', 'size', 'retention']);
  });

  it('sends the weekly digests, and only them, when the weekly schedule asks', async () => {
    const order: string[] = [];

    await expect(
      createJobsHandler(recordingDependencies(order))({ job: 'weekly-digest' }),
    ).resolves.toEqual({ ok: true, job: 'weekly-digest', digest: DIGEST });
    expect(order).toEqual(['parameters', 'digest']);
  });

  it('fails when the retention fails, so the failure shows in the logs and the alarm', async () => {
    const handler = createJobsHandler({
      ...recordingDependencies([]),
      runRetention: () => Promise.reject(new Error('Retention failed at: events.')),
    });

    await expect(handler()).rejects.toThrow('Retention failed at: events.');
  });
});
