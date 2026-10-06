import { createJobsHandler } from './jobs-handler';

const SIZE = { bytes: 300_000_000, limitBytes: 1_000_000_000, ratio: 0.3 };

describe('createJobsHandler', () => {
  it('loads the parameters, reports the database size, runs the retention, then reports both', async () => {
    const order: string[] = [];
    const handler = createJobsHandler({
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
        return Promise.resolve({ events: 12, sessions: 1, signInCodes: 2 });
      },
    });

    await expect(handler()).resolves.toEqual({
      ok: true,
      databaseSize: SIZE,
      retention: { events: 12, sessions: 1, signInCodes: 2 },
    });
    expect(order).toEqual(['parameters', 'size', 'retention']);
  });

  it('fails when the retention fails, so the scheduler retries', async () => {
    const handler = createJobsHandler({
      loadParameters: () => Promise.resolve(),
      reportDatabaseSize: () => Promise.resolve(SIZE),
      runRetention: () => Promise.reject(new Error('Retention failed at: events.')),
    });

    await expect(handler()).rejects.toThrow('Retention failed at: events.');
  });
});
