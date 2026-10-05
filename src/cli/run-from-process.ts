import type { CliCommand, CliContext } from './cli-command';
import { openCliContext } from './cli-context';
import { runCommand } from './run-command';

export async function runFromProcess<Args>(
  command: CliCommand<Args>,
  openContext: () => CliContext = () => openCliContext(process.env),
): Promise<void> {
  process.exitCode = await runCommand(command, process.argv.slice(2), openContext, {
    stdout: (line) => process.stdout.write(`${line}\n`),
    stderr: (line) => process.stderr.write(`${line}\n`),
  });
}
