import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  type BatchOutcome,
  batchCount,
  batchIntervalMs,
  buildBatch,
  formatReport,
  isClean,
  type LoadTestBatch,
  parseOptions,
  percentile,
  runLoadTest,
  summarize,
} from './load-test.mts';

const REQUIRED = [
  '--endpoint',
  'https://api.example.com/',
  '--key',
  'pyxis_pk_test',
  '--origin',
  'https://shop.example',
];

function outcome(status: number, durationMs: number, accepted = 0, rejected = 0): BatchOutcome {
  return { status, durationMs, accepted, rejected };
}

describe('parseOptions', () => {
  it('reads the target and falls back to 1,000 events a minute for 10 minutes', () => {
    assert.deepEqual(parseOptions(REQUIRED), {
      endpoint: 'https://api.example.com',
      key: 'pyxis_pk_test',
      origin: 'https://shop.example',
      eventsPerMinute: 1_000,
      minutes: 10,
      batchSize: 20,
      visits: 200,
    });
  });

  it('takes the load from the flags', () => {
    const options = parseOptions([
      ...REQUIRED,
      '--events-per-minute',
      '600',
      '--minutes',
      '2',
      '--batch-size',
      '50',
      '--visits',
      '10',
    ]);

    assert.equal(options.eventsPerMinute, 600);
    assert.equal(options.minutes, 2);
    assert.equal(options.batchSize, 50);
    assert.equal(options.visits, 10);
  });

  it('refuses a missing target, a load that is not a positive integer and an oversized batch', () => {
    assert.throws(() => parseOptions(REQUIRED.slice(2)), /--endpoint is required/);
    assert.throws(() => parseOptions([...REQUIRED.slice(0, 4), '--origin', '']), /--origin/);
    assert.throws(() => parseOptions([...REQUIRED, '--minutes', '0']), /positive integer/);
    assert.throws(() => parseOptions([...REQUIRED, '--visits', '1.5']), /positive integer/);
    assert.throws(() => parseOptions([...REQUIRED, '--batch-size', '51']), /at most 50/);
    assert.throws(() => parseOptions([...REQUIRED, '--unknown', 'x']));
  });
});

describe('the schedule', () => {
  it('spreads the batches evenly over the run', () => {
    const options = parseOptions(REQUIRED);

    assert.equal(batchCount(options), 500);
    assert.equal(batchIntervalMs(options), 1_200);
  });
});

describe('buildBatch', () => {
  it('builds a contract batch of page views and a named event every fourth event', () => {
    const options = parseOptions([...REQUIRED, '--batch-size', '4']);
    let next = 0;

    const batch = buildBatch(
      options,
      'visit-1',
      1,
      new Date('2026-10-07T03:00:00.000Z'),
      () => `id-${String((next += 1))}`,
    );

    assert.equal(batch.key, 'pyxis_pk_test');
    assert.equal(batch.sent_at, '2026-10-07T03:00:00.000Z');
    assert.deepEqual(
      batch.events.map((event) => [event.id, event.name, event.path, event.session_id]),
      [
        ['id-1', 'page_view', '/load-test/1', 'visit-1'],
        ['id-2', 'page_view', '/load-test/2', 'visit-1'],
        ['id-3', 'page_view', '/load-test/3', 'visit-1'],
        ['id-4', 'load_test_click', '/load-test/4', 'visit-1'],
      ],
    );
  });
});

describe('percentile', () => {
  it('takes the nearest rank, and 0 without samples', () => {
    const sorted = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

    assert.equal(percentile(sorted, 50), 50);
    assert.equal(percentile(sorted, 95), 100);
    assert.equal(percentile([7], 50), 7);
    assert.equal(percentile([], 95), 0);
  });
});

describe('summarize and report', () => {
  it('counts statuses, events and latencies', () => {
    const report = summarize([
      outcome(202, 120.4, 20),
      outcome(202, 80.2, 19, 1),
      outcome(429, 5),
      outcome(0, 3_000),
    ]);

    assert.deepEqual(report, {
      batches: 4,
      accepted: 39,
      rejected: 1,
      statuses: { '202': 2, '429': 1, 'no response': 1 },
      p50Ms: 80,
      p95Ms: 3_000,
      maxMs: 3_000,
    });
    assert.equal(isClean(report), false);
    assert.equal(isClean(summarize([outcome(202, 10, 20)])), true);
  });

  it('reports an empty run as zeros', () => {
    assert.deepEqual(summarize([]), {
      batches: 0,
      accepted: 0,
      rejected: 0,
      statuses: {},
      p50Ms: 0,
      p95Ms: 0,
      maxMs: 0,
    });
  });

  it('writes the lines a pull request body can quote', () => {
    const options = parseOptions(REQUIRED);
    const text = formatReport(options, summarize([outcome(202, 100, 20), outcome(500, 300)]));

    assert.equal(
      text,
      [
        'Target: https://api.example.com/v1/batch, origin https://shop.example',
        'Load: 1000 events/min for 10 min, 20 events per batch, 200 visits',
        'Batches: 2 (202 x 1, 500 x 1)',
        'Events: 20 accepted, 0 rejected',
        'Latency: p50 100 ms, p95 300 ms, max 300 ms',
      ].join('\n'),
    );
  });
});

describe('runLoadTest', () => {
  it('sends every batch on its schedule, rotating the visits, and summarizes the answers', async () => {
    const options = parseOptions([
      ...REQUIRED,
      '--events-per-minute',
      '60',
      '--minutes',
      '1',
      '--batch-size',
      '20',
      '--visits',
      '2',
    ]);
    const waits: number[] = [];
    const sent: LoadTestBatch[] = [];
    let next = 0;

    const report = await runLoadTest(options, {
      send: (batch) => {
        sent.push(batch);
        return Promise.resolve(outcome(202, 50, batch.events.length));
      },
      waitUntil: (elapsedMs) => {
        waits.push(elapsedMs);
        return Promise.resolve();
      },
      now: () => new Date('2026-10-07T03:00:00.000Z'),
      createId: () => `id-${String((next += 1))}`,
    });

    assert.deepEqual(waits, [0, 20_000, 40_000]);
    assert.deepEqual(
      sent.map((batch) => batch.events[0]?.session_id),
      ['id-1', 'id-2', 'id-1'],
    );
    assert.equal(report.batches, 3);
    assert.equal(report.accepted, 60);
  });
});
