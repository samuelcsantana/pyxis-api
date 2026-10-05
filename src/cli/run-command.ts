import { DomainError } from '../domain/errors/domain.error';
import { CliUsageError } from './cli-args';
import type { CliCommand, CliContext, CommandOutput } from './cli-command';

export const EXIT_SUCCESS = 0;
export const EXIT_FAILURE = 1;
export const EXIT_USAGE = 2;

function describeFailure(error: unknown): string {
  if (error instanceof DomainError) {
    return error.message;
  }
  return `Unexpected error: ${error instanceof Error ? error.message : String(error)}`;
}

export async function runCommand<Args>(
  command: CliCommand<Args>,
  argv: readonly string[],
  openContext: () => CliContext,
  output: CommandOutput,
): Promise<number> {
  let args: Args;
  try {
    args = command.parse(argv);
  } catch (error) {
    output.stderr(error instanceof CliUsageError ? error.message : describeFailure(error));
    output.stderr(`Usage: ${command.usage}`);
    return EXIT_USAGE;
  }
  let context: CliContext | undefined;
  try {
    context = openContext();
    await command.execute(context, args, output);
    return EXIT_SUCCESS;
  } catch (error) {
    output.stderr(describeFailure(error));
    return EXIT_FAILURE;
  } finally {
    await context?.close();
  }
}
