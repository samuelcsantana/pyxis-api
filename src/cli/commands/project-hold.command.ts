import { MAX_DELETION_HOLD_REASON_LENGTH } from '../../domain/accounts/account-deletion-hold';
import { CliUsageError, parseCommandArgs, requiredId, requiredText } from '../cli-args';
import type { CliCommand } from '../cli-command';

export interface ProjectHoldArgs {
  readonly projectId: string;
  readonly reason: string;
}

export const projectHoldCommand: CliCommand<ProjectHoldArgs> = {
  usage: 'npm run -s project:hold -- --project <id> --reason "<the dispute or the order>"',

  parse(argv) {
    const values = parseCommandArgs(argv, {
      project: { type: 'string' },
      reason: { type: 'string' },
    });
    const reason = requiredText(values, 'reason').trim();
    if (reason.length > MAX_DELETION_HOLD_REASON_LENGTH) {
      throw new CliUsageError(
        `--reason holds at most ${String(MAX_DELETION_HOLD_REASON_LENGTH)} characters.`,
      );
    }
    return { projectId: requiredId(values, 'project'), reason };
  },

  async execute(context, args, output) {
    const held = await context.holdProjectDeletion.execute(args);
    output.stdout(`project_id=${held.projectId}`);
    output.stdout(`name=${held.projectName}`);
    output.stdout(`deletion_held_at=${held.heldAt.toISOString()}`);
    output.stdout(`deletion_hold_reason=${held.reason}`);
    output.stderr(
      'Its owner cannot delete the project, the retention keeps its events, and the deletion of ' +
        'its account keeps it, until `project:release`.',
    );
  },
};
