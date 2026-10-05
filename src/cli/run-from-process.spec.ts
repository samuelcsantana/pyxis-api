import { inMemoryCliContext } from '../test-utils/cli-test-context';
import type { CliCommand } from './cli-command';
import { runFromProcess } from './run-from-process';

const echo: CliCommand<readonly string[]> = {
  usage: 'npm run -s echo',
  parse: (argv) => argv,
  execute: (_context, args, output) => {
    output.stdout(args.join(' '));
    output.stderr('note');
    return Promise.resolve();
  },
};

function restore(name: string, value: string | undefined): void {
  if (value === undefined) {
    Reflect.deleteProperty(process.env, name);
  } else {
    process.env[name] = value;
  }
}

describe('runFromProcess', () => {
  const originalArgv = process.argv;

  afterEach(() => {
    process.argv = originalArgv;
    process.exitCode = undefined;
    jest.restoreAllMocks();
  });

  it('runs the command on the process arguments, writing lines and setting the exit code', async () => {
    process.argv = ['node', 'script.js', '--kind', 'secret'];
    const stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

    await runFromProcess(echo, inMemoryCliContext);

    expect(stdout).toHaveBeenCalledWith('--kind secret\n');
    expect(stderr).toHaveBeenCalledWith('note\n');
    expect(process.exitCode).toBe(0);
  });

  it('opens the database from the environment by default', async () => {
    process.argv = ['node', 'script.js'];
    const stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const previous = {
      migration: process.env.MIGRATION_DATABASE_URL,
      app: process.env.DATABASE_URL,
    };
    restore('MIGRATION_DATABASE_URL', undefined);
    restore('DATABASE_URL', undefined);

    try {
      await runFromProcess(echo);
    } finally {
      restore('MIGRATION_DATABASE_URL', previous.migration);
      restore('DATABASE_URL', previous.app);
    }

    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('MIGRATION_DATABASE_URL'));
    expect(process.exitCode).toBe(1);
  });
});
