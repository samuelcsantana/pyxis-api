import { createJobsHandler } from './jobs-handler';

describe('createJobsHandler', () => {
  it('loads the parameters before running the retention, then reports it', async () => {
    const order: string[] = [];
    const handler = createJobsHandler({
      loadParameters: () => {
        order.push('parameters');
        return Promise.resolve();
      },
      runRetention: () => {
        order.push('retention');
        return Promise.resolve({ events: 12, sessions: 1, signInCodes: 2 });
      },
    });

    await expect(handler()).resolves.toEqual({
      ok: true,
      retention: { events: 12, sessions: 1, signInCodes: 2 },
    });
    expect(order).toEqual(['parameters', 'retention']);
  });

  it('fails when the retention fails, so the scheduler retries', async () => {
    const handler = createJobsHandler({
      loadParameters: () => Promise.resolve(),
      runRetention: () => Promise.reject(new Error('Retention failed at: events.')),
    });

    await expect(handler()).rejects.toThrow('Retention failed at: events.');
  });
});
