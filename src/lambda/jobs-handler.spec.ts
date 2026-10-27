import { Logger } from '@nestjs/common';
import { createJobsHandler, DAILY_JOB, type JobsHandlerDependencies } from './jobs-handler';

const SIZE = { bytes: 300_000_000, limitBytes: 1_000_000_000, ratio: 0.3 };
const RETENTION = {
  events: 12,
  sessions: 1,
  signInCodes: 2,
  trialCards: 0,
  oauthConnections: 1,
  oauthTokens: 4,
  oauthRequests: 2,
};
const DIGEST = { sent: 2, alreadySent: 1, failed: 0 };
const ICONS = { found: 2, removed: 0, unreachable: 1 };
const EXPORTS = { done: 1, failed: 0 };
const NOTICES = { sent: 3, failed: 0 };
const DEMO_TRAFFIC = { projects: 1, inserted: 480 };
const LIFECYCLE = {
  freePlacesOpened: 0,
  welcomes: 1,
  reconciled: 4,
  statusChanges: 1,
  reconcileFailures: 0,
  keysRevoked: 1,
  endedNotices: 1,
  reminders: 0,
  deleted: 0,
  partlyHeld: 0,
  incompleteRemoved: 2,
  peopleRemoved: 2,
  projectlessMarked: 1,
  projectlessRemoved: 0,
};
const ACCOUNT_USAGE = {
  month: '2026-10',
  accounts: 3,
  paused: 1,
  notified: 2,
  notificationsFailed: 0,
};

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
    measureAccountUsage: () => {
      order.push('usage');
      return Promise.resolve(ACCOUNT_USAGE);
    },
    runAccountLifecycle: () => {
      order.push('lifecycle');
      return Promise.resolve(LIFECYCLE);
    },
    processExport: (exportId) => {
      order.push(`export ${exportId}`);
      return Promise.resolve('done');
    },
    processStalledExports: () => {
      order.push('exports');
      return Promise.resolve(EXPORTS);
    },
    sendWeeklyDigests: () => {
      order.push('digest');
      return Promise.resolve(DIGEST);
    },
    sendOperatorNotices: () => {
      order.push('notices');
      return Promise.resolve(NOTICES);
    },
    refreshProjectIcons: () => {
      order.push('icons');
      return Promise.resolve(ICONS);
    },
    generateDemoTraffic: () => {
      order.push('demo traffic');
      return Promise.resolve(DEMO_TRAFFIC);
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
  ])(
    'runs the daily jobs for %s: parameters to demo traffic, notices before the icons',
    async (_label, event) => {
      const order: string[] = [];

      await expect(createJobsHandler(recordingDependencies(order))(event)).resolves.toEqual({
        ok: true,
        job: 'daily',
        databaseSize: SIZE,
        retention: RETENTION,
        accountUsage: ACCOUNT_USAGE,
        accountLifecycle: LIFECYCLE,
        exports: EXPORTS,
        operatorNotices: NOTICES,
        projectIcons: ICONS,
        demoTraffic: DEMO_TRAFFIC,
      });
      expect(order).toEqual([
        'parameters',
        'size',
        'retention',
        'usage',
        'lifecycle',
        'exports',
        'notices',
        'icons',
        'demo traffic',
      ]);
    },
  );

  it('sends the weekly digests, and only them, when the weekly schedule asks', async () => {
    const order: string[] = [];

    await expect(
      createJobsHandler(recordingDependencies(order))({ job: 'weekly-digest' }),
    ).resolves.toEqual({ ok: true, job: 'weekly-digest', digest: DIGEST });
    expect(order).toEqual(['parameters', 'digest']);
  });

  it('sends the pending notices, and only them, when the operator asks', async () => {
    const order: string[] = [];

    await expect(
      createJobsHandler(recordingDependencies(order))({ job: 'account-notices' }),
    ).resolves.toEqual({ ok: true, job: 'account-notices', operatorNotices: NOTICES });
    expect(order).toEqual(['parameters', 'notices']);
  });

  it('runs one export, and only it, when the jobs function is handed one', async () => {
    const order: string[] = [];

    await expect(
      createJobsHandler(recordingDependencies(order))({ job: 'export', exportId: 'e-1' }),
    ).resolves.toEqual({ ok: true, job: 'export', exportId: 'e-1', outcome: 'done' });
    expect(order).toEqual(['parameters', 'export e-1']);
  });

  it('runs the daily jobs when they are asked for by name, as jobs:run does', async () => {
    await expect(
      createJobsHandler(recordingDependencies([]))({ job: DAILY_JOB }),
    ).resolves.toMatchObject({ job: DAILY_JOB });
  });

  it('runs the daily jobs for an export event without an export id', async () => {
    await expect(
      createJobsHandler(recordingDependencies([]))({ job: 'export', exportId: 7 }),
    ).resolves.toMatchObject({ job: 'daily' });
  });

  it('finishes the daily jobs when the icons fail, logging what it swallowed', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const handler = createJobsHandler({
      ...recordingDependencies([]),
      refreshProjectIcons: () => Promise.reject(new Error('database went away')),
    });

    await expect(handler()).resolves.toMatchObject({ job: 'daily', projectIcons: null });
    error.mockRestore();
  });

  it('finishes the daily jobs when the demo traffic fails, logging what it swallowed', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const handler = createJobsHandler({
      ...recordingDependencies([]),
      generateDemoTraffic: () => Promise.reject(new Error('insert timed out')),
    });

    await expect(handler()).resolves.toMatchObject({
      job: 'daily',
      projectIcons: ICONS,
      demoTraffic: null,
    });
    expect(error).toHaveBeenCalledWith({
      message: 'jobs.demo_traffic_failed',
      reason: 'insert timed out',
    });
    error.mockRestore();
  });

  it('logs a demo traffic failure that is not an Error too', async () => {
    const handler = createJobsHandler({
      ...recordingDependencies([]),
      generateDemoTraffic: jest
        .fn<Promise<typeof DEMO_TRAFFIC>, []>()
        .mockRejectedValue('connection reset'),
    });

    await expect(handler()).resolves.toMatchObject({ demoTraffic: null });
  });

  it('logs a failure that is not an Error too', async () => {
    const handler = createJobsHandler({
      ...recordingDependencies([]),
      refreshProjectIcons: jest.fn<Promise<typeof ICONS>, []>().mockRejectedValue('timeout'),
    });

    await expect(handler()).resolves.toMatchObject({ projectIcons: null });
  });

  it('fails when the retention fails, so the failure shows in the logs and the alarm', async () => {
    const handler = createJobsHandler({
      ...recordingDependencies([]),
      runRetention: () => Promise.reject(new Error('Retention failed at: events.')),
    });

    await expect(handler()).rejects.toThrow('Retention failed at: events.');
  });

  it('fails when measuring the accounts fails, so the schedule runs it again', async () => {
    const order: string[] = [];
    const handler = createJobsHandler({
      ...recordingDependencies(order),
      measureAccountUsage: () => Promise.reject(new Error('connection lost')),
    });

    await expect(handler()).rejects.toThrow('connection lost');
    expect(order).toEqual(['parameters', 'size', 'retention']);
  });

  it('fails when the account lifecycle fails, after the other accounts were handled', async () => {
    const order: string[] = [];
    const handler = createJobsHandler({
      ...recordingDependencies(order),
      runAccountLifecycle: () =>
        Promise.reject(new Error('The account lifecycle failed for 1 account(s).')),
    });

    await expect(handler()).rejects.toThrow('The account lifecycle failed for 1 account(s).');
    expect(order).toEqual(['parameters', 'size', 'retention', 'usage']);
  });
});
