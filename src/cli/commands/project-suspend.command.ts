import { MAX_SUSPENSION_REASON_LENGTH } from '../../domain/accounts/account-suspension';
import { CliUsageError, parseCommandArgs, requiredId, requiredText } from '../cli-args';
import type { CliCommand } from '../cli-command';

export interface ProjectSuspendArgs {
  readonly projectId: string;
  readonly reason: string;
}

export const projectSuspendCommand: CliCommand<ProjectSuspendArgs> = {
  usage: 'npm run -s project:suspend -- --project <id> --reason "<why, as told to the owner>"',

  parse(argv) {
    const values = parseCommandArgs(argv, {
      project: { type: 'string' },
      reason: { type: 'string' },
    });
    const reason = requiredText(values, 'reason').trim();
    if (reason.length > MAX_SUSPENSION_REASON_LENGTH) {
      throw new CliUsageError(
        `--reason holds at most ${String(MAX_SUSPENSION_REASON_LENGTH)} characters.`,
      );
    }
    return { projectId: requiredId(values, 'project'), reason };
  },

  async execute(context, args, output) {
    const suspended = await context.suspendProjectIngestion.execute(args);
    output.stdout(`project_id=${suspended.projectId}`);
    output.stdout(`name=${suspended.projectName}`);
    output.stdout(`ingestion_suspended_at=${suspended.suspendedAt.toISOString()}`);
    output.stdout(`ingestion_suspension_reason=${suspended.reason}`);
    output.stderr(
      'Within a minute the project stops taking events; its screens stay open. E-mail the ' +
        'owner the reason and how to contest it; `project:resume` lifts it.',
    );
  },
};
