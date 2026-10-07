import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';

export interface LoadTestOptions {
  readonly endpoint: string;
  readonly key: string;
  readonly origin: string;
  readonly eventsPerMinute: number;
  readonly minutes: number;
  readonly batchSize: number;
  readonly visits: number;
}

export interface BatchOutcome {
  readonly status: number;
  readonly durationMs: number;
  readonly accepted: number;
  readonly rejected: number;
}

export interface LoadTestReport {
  readonly batches: number;
  readonly accepted: number;
  readonly rejected: number;
  readonly statuses: Readonly<Record<string, number>>;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly maxMs: number;
}

export interface LoadTestEvent {
  readonly id: string;
  readonly name: string;
  readonly occurred_at: string;
  readonly session_id: string;
  readonly path: string;
}

export interface LoadTestBatch {
  readonly key: string;
  readonly sent_at: string;
  readonly events: readonly LoadTestEvent[];
}

export interface LoadTestDependencies {
  readonly send: (batch: LoadTestBatch) => Promise<BatchOutcome>;
  readonly waitUntil: (elapsedMs: number) => Promise<void>;
  readonly now: () => Date;
  readonly createId: () => string;
}

const MAX_EVENTS_PER_BATCH = 50;
const DEFAULT_EVENTS_PER_MINUTE = 1_000;
const DEFAULT_MINUTES = 10;
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_VISITS = 200;
const MILLISECONDS_PER_MINUTE = 60_000;
const ACCEPTED_STATUS = 202;
const NO_RESPONSE_STATUS = 0;
const PAGE_COUNT = 5;
const NAMED_EVENT_EVERY = 4;
const NAMED_EVENT = 'load_test_click';
const PAGE_VIEW_EVENT = 'page_view';
const MEDIAN_PERCENTILE = 50;
const TAIL_PERCENTILE = 95;
const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/141.0.0.0 Safari/537.36';
const USAGE =
  'Usage: node scripts/load-test.mts --endpoint <url> --key <public key> --origin <origin> ' +
  '[--events-per-minute 1000] [--minutes 10] [--batch-size 20] [--visits 200]';

function requiredText(value: string | undefined, name: string): string {
  if (value === undefined || value === '') {
    throw new Error(`--${name} is required. ${USAGE}`);
  }
  return value;
}

function positiveInteger(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`--${name} must be a positive integer, got "${value}".`);
  }
  return parsed;
}

export function parseOptions(argv: readonly string[]): LoadTestOptions {
  const { values } = parseArgs({
    args: [...argv],
    strict: true,
    options: {
      endpoint: { type: 'string' },
      key: { type: 'string' },
      origin: { type: 'string' },
      'events-per-minute': { type: 'string' },
      minutes: { type: 'string' },
      'batch-size': { type: 'string' },
      visits: { type: 'string' },
    },
  });
  const batchSize = positiveInteger(values['batch-size'], DEFAULT_BATCH_SIZE, 'batch-size');
  if (batchSize > MAX_EVENTS_PER_BATCH) {
    throw new Error(
      `--batch-size is at most ${String(MAX_EVENTS_PER_BATCH)}, got ${String(batchSize)}.`,
    );
  }
  return {
    endpoint: requiredText(values.endpoint, 'endpoint').replace(/\/+$/, ''),
    key: requiredText(values.key, 'key'),
    origin: requiredText(values.origin, 'origin'),
    eventsPerMinute: positiveInteger(
      values['events-per-minute'],
      DEFAULT_EVENTS_PER_MINUTE,
      'events-per-minute',
    ),
    minutes: positiveInteger(values.minutes, DEFAULT_MINUTES, 'minutes'),
    batchSize,
    visits: positiveInteger(values.visits, DEFAULT_VISITS, 'visits'),
  };
}

export function batchCount(options: LoadTestOptions): number {
  return Math.round((options.eventsPerMinute * options.minutes) / options.batchSize);
}

export function batchIntervalMs(options: LoadTestOptions): number {
  return (MILLISECONDS_PER_MINUTE * options.batchSize) / options.eventsPerMinute;
}

export function buildBatch(
  options: LoadTestOptions,
  sessionId: string,
  sequence: number,
  now: Date,
  createId: () => string,
): LoadTestBatch {
  const occurredAt = now.toISOString();
  return {
    key: options.key,
    sent_at: occurredAt,
    events: Array.from({ length: options.batchSize }, (_, index) => ({
      id: createId(),
      name: (sequence + index) % NAMED_EVENT_EVERY === 0 ? NAMED_EVENT : PAGE_VIEW_EVENT,
      occurred_at: occurredAt,
      session_id: sessionId,
      path: `/load-test/${String((sequence + index) % PAGE_COUNT)}`,
    })),
  };
}

export function percentile(sortedDurations: readonly number[], rank: number): number {
  if (sortedDurations.length === 0) {
    return 0;
  }
  const index = Math.max(0, Math.ceil((rank / 100) * sortedDurations.length) - 1);
  return sortedDurations[index] ?? 0;
}

export function summarize(outcomes: readonly BatchOutcome[]): LoadTestReport {
  const durations = outcomes.map((outcome) => outcome.durationMs).toSorted((a, b) => a - b);
  const statuses: Record<string, number> = {};
  for (const outcome of outcomes) {
    const label = outcome.status === NO_RESPONSE_STATUS ? 'no response' : String(outcome.status);
    statuses[label] = (statuses[label] ?? 0) + 1;
  }
  return {
    batches: outcomes.length,
    accepted: outcomes.reduce((sum, outcome) => sum + outcome.accepted, 0),
    rejected: outcomes.reduce((sum, outcome) => sum + outcome.rejected, 0),
    statuses,
    p50Ms: Math.round(percentile(durations, MEDIAN_PERCENTILE)),
    p95Ms: Math.round(percentile(durations, TAIL_PERCENTILE)),
    maxMs: Math.round(durations.at(-1) ?? 0),
  };
}

export function formatReport(options: LoadTestOptions, report: LoadTestReport): string {
  const statuses = Object.entries(report.statuses)
    .map(([status, count]) => `${status} x ${String(count)}`)
    .join(', ');
  return [
    `Target: ${options.endpoint}/v1/batch, origin ${options.origin}`,
    `Load: ${String(options.eventsPerMinute)} events/min for ${String(options.minutes)} min, ` +
      `${String(options.batchSize)} events per batch, ${String(options.visits)} visits`,
    `Batches: ${String(report.batches)} (${statuses})`,
    `Events: ${String(report.accepted)} accepted, ${String(report.rejected)} rejected`,
    `Latency: p50 ${String(report.p50Ms)} ms, p95 ${String(report.p95Ms)} ms, max ${String(report.maxMs)} ms`,
  ].join('\n');
}

export function isClean(report: LoadTestReport): boolean {
  return Object.keys(report.statuses).every((status) => status === String(ACCEPTED_STATUS));
}

export async function runLoadTest(
  options: LoadTestOptions,
  dependencies: LoadTestDependencies,
): Promise<LoadTestReport> {
  const visitIds = Array.from({ length: options.visits }, () => dependencies.createId());
  const interval = batchIntervalMs(options);
  const pending: Promise<BatchOutcome>[] = [];
  for (let sequence = 0; sequence < batchCount(options); sequence += 1) {
    await dependencies.waitUntil(sequence * interval);
    const sessionId = visitIds[sequence % visitIds.length] ?? dependencies.createId();
    const batch = buildBatch(
      options,
      sessionId,
      sequence,
      dependencies.now(),
      dependencies.createId,
    );
    pending.push(dependencies.send(batch));
  }
  return summarize(await Promise.all(pending));
}

function counted(body: unknown, field: 'accepted' | 'rejected'): number {
  if (typeof body !== 'object' || body === null) {
    return 0;
  }
  const value: unknown = Reflect.get(body, field);
  return typeof value === 'number' ? value : 0;
}

function httpSender(options: LoadTestOptions): (batch: LoadTestBatch) => Promise<BatchOutcome> {
  return async (batch) => {
    const started = performance.now();
    try {
      const response = await fetch(`${options.endpoint}/v1/batch`, {
        method: 'POST',
        headers: {
          'content-type': 'text/plain;charset=UTF-8',
          origin: options.origin,
          'user-agent': DESKTOP_USER_AGENT,
        },
        body: JSON.stringify(batch),
      });
      const body: unknown = await response.json().catch(() => null);
      return {
        status: response.status,
        durationMs: performance.now() - started,
        accepted: counted(body, 'accepted'),
        rejected: counted(body, 'rejected'),
      };
    } catch {
      return {
        status: NO_RESPONSE_STATUS,
        durationMs: performance.now() - started,
        accepted: 0,
        rejected: 0,
      };
    }
  };
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const startedAt = performance.now();
  console.log(
    `Sending ${String(batchCount(options))} batches, one every ${String(Math.round(batchIntervalMs(options)))} ms.`,
  );
  const report = await runLoadTest(options, {
    send: httpSender(options),
    waitUntil: async (elapsedMs) => {
      const remaining = startedAt + elapsedMs - performance.now();
      if (remaining > 0) {
        await sleep(remaining);
      }
    },
    now: () => new Date(),
    createId: randomUUID,
  });
  console.log(formatReport(options, report));
  if (!isClean(report)) {
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  await main();
}
