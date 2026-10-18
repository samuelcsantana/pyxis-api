import { EXPORT_JOB } from '../infra/exports/lambda-export-dispatcher';
import { DAILY_JOB, OPERATOR_NOTICES_JOB, WEEKLY_DIGEST_JOB } from '../lambda/jobs-handler';
import {
  CliUsageError,
  optionalText,
  parseCommandArgs,
  requiredId,
  usageErrorFrom,
} from './cli-args';
import type { CommandOutput } from './cli-command';
import { EXIT_FAILURE, EXIT_SUCCESS, EXIT_USAGE } from './run-command';

export const JOBS_RUN_USAGE =
  'npm run -s jobs:run -- [--job daily|weekly-digest|account-notices|export] [--export-id <uuid>]';

const NAMED_JOBS = [DAILY_JOB, WEEKLY_DIGEST_JOB, OPERATOR_NOTICES_JOB] as const;

type NamedJob = (typeof NAMED_JOBS)[number];

export type JobsEvent =
  { readonly job: NamedJob } | { readonly job: typeof EXPORT_JOB; readonly exportId: string };

export type JobsRunner = (event: JobsEvent) => Promise<unknown>;

function isNamedJob(job: string): job is NamedJob {
  return NAMED_JOBS.some((named) => named === job);
}

export function jobsEventFrom(argv: readonly string[]): JobsEvent {
  const values = parseCommandArgs(argv, {
    job: { type: 'string' },
    'export-id': { type: 'string' },
  });
  const job = optionalText(values, 'job') ?? DAILY_JOB;
  if (job === EXPORT_JOB) {
    return { job, exportId: requiredId(values, 'export-id') };
  }
  if (!isNamedJob(job)) {
    throw new CliUsageError(`Unknown job: ${job}.`);
  }
  if (optionalText(values, 'export-id') !== undefined) {
    throw new CliUsageError('--export-id goes only with --job export.');
  }
  return { job };
}

function describeFailure(error: unknown): string {
  return `The job failed: ${error instanceof Error ? error.message : String(error)}`;
}

export async function runJobs(
  run: JobsRunner,
  argv: readonly string[],
  output: CommandOutput,
): Promise<number> {
  let event: JobsEvent;
  try {
    event = jobsEventFrom(argv);
  } catch (error) {
    output.stderr(usageErrorFrom(error).message);
    output.stderr(`Usage: ${JOBS_RUN_USAGE}`);
    return EXIT_USAGE;
  }
  try {
    output.stdout(JSON.stringify(await run(event)));
    return EXIT_SUCCESS;
  } catch (error) {
    output.stderr(describeFailure(error));
    return EXIT_FAILURE;
  }
}
