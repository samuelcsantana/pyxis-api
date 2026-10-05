import { ProjectNotFoundError } from '../domain/errors/project.errors';
import { captureOutput, inMemoryCliContext } from '../test-utils/cli-test-context';
import { CliUsageError } from './cli-args';
import type { CliCommand } from './cli-command';
import { EXIT_FAILURE, EXIT_SUCCESS, EXIT_USAGE, runCommand } from './run-command';

function command(overrides: Partial<CliCommand<string>> = {}): CliCommand<string> {
  return {
    usage: 'npm run -s probe -- --x <value>',
    parse: (argv) => argv.join(' '),
    execute: (_context, args, output) => {
      output.stdout(`ran ${args}`);
      return Promise.resolve();
    },
    ...overrides,
  };
}

describe('runCommand', () => {
  it('parses, runs, closes the context and exits with 0', async () => {
    const context = inMemoryCliContext();
    const output = captureOutput();

    const exitCode = await runCommand(command(), ['--x', '1'], () => context, output);

    expect(exitCode).toBe(EXIT_SUCCESS);
    expect(output.out).toEqual(['ran --x 1']);
    expect(context.closed).toBe(true);
  });

  it('prints the usage and exits with 2 without opening the database when parsing fails', async () => {
    const openContext = jest.fn(inMemoryCliContext);
    const output = captureOutput();
    const failing = command({
      parse: () => {
        throw new CliUsageError('--x is required.');
      },
    });

    const exitCode = await runCommand(failing, [], openContext, output);

    expect(exitCode).toBe(EXIT_USAGE);
    expect(output.err).toEqual(['--x is required.', 'Usage: npm run -s probe -- --x <value>']);
    expect(openContext).not.toHaveBeenCalled();
  });

  it('reports an unexpected parsing failure as such', async () => {
    const output = captureOutput();
    const failing = command({
      parse: () => {
        throw new Error('boom');
      },
    });

    await runCommand(failing, [], inMemoryCliContext, output);

    expect(output.err[0]).toBe('Unexpected error: boom');
  });

  it('prints a domain error as is, exits with 1 and still closes the context', async () => {
    const context = inMemoryCliContext();
    const output = captureOutput();
    const failing = command({ execute: () => Promise.reject(new ProjectNotFoundError()) });

    const exitCode = await runCommand(failing, [], () => context, output);

    expect(exitCode).toBe(EXIT_FAILURE);
    expect(output.err).toEqual(['No project has this id.']);
    expect(context.closed).toBe(true);
  });

  it('exits with 1 when the database cannot be opened', async () => {
    const output = captureOutput();

    const exitCode = await runCommand(
      command(),
      [],
      () => {
        throw new Error('MIGRATION_DATABASE_URL (or DATABASE_URL) is required');
      },
      output,
    );

    expect(exitCode).toBe(EXIT_FAILURE);
    expect(output.err).toEqual([
      expect.stringContaining('Unexpected error: MIGRATION_DATABASE_URL'),
    ]);
  });

  it('describes something thrown that is not an Error', async () => {
    const output = captureOutput();
    const failing = command({ execute: () => Promise.reject(new Error('lost connection')) });

    await runCommand(failing, [], inMemoryCliContext, output);
    await runCommand(
      command({
        execute: () => {
          const failure: unknown = 'plain failure';
          throw failure;
        },
      }),
      [],
      inMemoryCliContext,
      output,
    );

    expect(output.err).toEqual([
      'Unexpected error: lost connection',
      'Unexpected error: plain failure',
    ]);
  });
});
