import { MAX_DELETION_HOLD_REASON_LENGTH } from '../../domain/accounts/account-deletion-hold';
import { CliUsageError, parseCommandArgs, requiredId, requiredText } from '../cli-args';
import type { CliCommand } from '../cli-command';

export interface AccountHoldArgs {
  readonly accountId: string;
  readonly reason: string;
}

export const accountHoldCommand: CliCommand<AccountHoldArgs> = {
  usage: 'npm run -s account:hold -- --account <id> --reason "<the dispute or the order>"',

  parse(argv) {
    const values = parseCommandArgs(argv, {
      account: { type: 'string' },
      reason: { type: 'string' },
    });
    const reason = requiredText(values, 'reason').trim();
    if (reason.length > MAX_DELETION_HOLD_REASON_LENGTH) {
      throw new CliUsageError(
        `--reason holds at most ${String(MAX_DELETION_HOLD_REASON_LENGTH)} characters.`,
      );
    }
    return { accountId: requiredId(values, 'account'), reason };
  },

  async execute(context, args, output) {
    const account = await context.holdAccountDeletion.execute(args);
    output.stdout(`account_id=${account.id}`);
    output.stdout(`status=${account.status}`);
    output.stdout(`deletion_held_at=${account.deletionHeldAt.toISOString()}`);
    output.stdout(`deletion_hold_reason=${account.deletionHoldReason}`);
    output.stderr(
      'The daily job will neither remind nor delete the account, and its owner cannot delete ' +
        'its projects, until `account:release`.',
    );
  },
};
