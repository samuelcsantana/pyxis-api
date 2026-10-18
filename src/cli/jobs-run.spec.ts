import { EXPORT_JOB } from '../infra/exports/lambda-export-dispatcher';
import { DAILY_JOB, OPERATOR_NOTICES_JOB, WEEKLY_DIGEST_JOB } from '../lambda/jobs-handler';
import { CliUsageError } from './cli-args';
import { JOBS_RUN_USAGE, type JobsEvent, jobsEventFrom, runJobs } from './jobs-run';
import { EXIT_FAILURE, EXIT_SUCCESS, EXIT_USAGE } from './run-command';

const EXPORT_ID = '6f1d3c2a-8b4e-4f7a-9c1d-2e3f4a5b6c7d';

function capture() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    output: {
      stdout: (line: string) => stdout.push(line),
      stderr: (line: string) => stderr.push(line),
    },
  };
}

describe('jobsEventFrom', () => {
  it('runs the daily jobs when no job is named', () => {
    expect(jobsEventFrom([])).toEqual({ job: DAILY_JOB });
  });

  it.each([DAILY_JOB, WEEKLY_DIGEST_JOB, OPERATOR_NOTICES_JOB])('names the %s job', (job) => {
    expect(jobsEventFrom(['--job', job])).toEqual({ job });
  });

  it('builds one export from its id', () => {
    expect(jobsEventFrom(['--job', EXPORT_JOB, '--export-id', EXPORT_ID.toUpperCase()])).toEqual({
      job: EXPORT_JOB,
      exportId: EXPORT_ID,
    });
  });

  it.each([
    ['an unknown job', ['--job', 'cleanup'], 'Unknown job: cleanup.'],
    ['an export without its id', ['--job', EXPORT_JOB], '--export-id is required.'],
    [
      'an export id that is not a UUID',
      ['--job', EXPORT_JOB, '--export-id', 'latest'],
      '--export-id must be a UUID.',
    ],
    [
      'an export id with another job',
      ['--job', WEEKLY_DIGEST_JOB, '--export-id', EXPORT_ID],
      '--export-id goes only with --job export.',
    ],
    ['an unknown option', ['--everything'], "Unknown option '--everything'"],
  ])('refuses %s', (_, argv, message) => {
    expect(() => jobsEventFrom(argv)).toThrow(CliUsageError);
    expect(() => jobsEventFrom(argv)).toThrow(message);
  });
});

describe('runJobs', () => {
  it('runs the job and prints its outcome as one JSON line', async () => {
    const events: JobsEvent[] = [];
    const { stdout, stderr, output } = capture();

    const exitCode = await runJobs(
      (event) => {
        events.push(event);
        return Promise.resolve({ ok: true, job: WEEKLY_DIGEST_JOB, digest: { sent: 2 } });
      },
      ['--job', WEEKLY_DIGEST_JOB],
      output,
    );

    expect(exitCode).toBe(EXIT_SUCCESS);
    expect(events).toEqual([{ job: WEEKLY_DIGEST_JOB }]);
    expect(stdout).toEqual(['{"ok":true,"job":"weekly-digest","digest":{"sent":2}}']);
    expect(stderr).toEqual([]);
  });

  it('runs nothing and prints the usage when the arguments are wrong', async () => {
    const run = jest.fn();
    const { stdout, stderr, output } = capture();

    const exitCode = await runJobs(run, ['--job', 'cleanup'], output);

    expect(exitCode).toBe(EXIT_USAGE);
    expect(run).not.toHaveBeenCalled();
    expect(stdout).toEqual([]);
    expect(stderr).toEqual(['Unknown job: cleanup.', `Usage: ${JOBS_RUN_USAGE}`]);
  });

  it.each([
    ['an error', new Error('connection refused'), 'The job failed: connection refused'],
    ['anything else', 'timeout', 'The job failed: timeout'],
  ])('fails with a message when the job throws %s', async (_, failure, message) => {
    const { stdout, stderr, output } = capture();

    const run = jest.fn<Promise<unknown>, [JobsEvent]>().mockRejectedValue(failure);

    const exitCode = await runJobs(run, [], output);

    expect(exitCode).toBe(EXIT_FAILURE);
    expect(stdout).toEqual([]);
    expect(stderr).toEqual([message]);
  });
});
