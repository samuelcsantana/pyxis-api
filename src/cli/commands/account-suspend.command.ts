import { MAX_SUSPENSION_REASON_LENGTH } from '../../domain/accounts/account-suspension';
import { CliUsageError, parseCommandArgs, requiredId, requiredText } from '../cli-args';
import type { CliCommand } from '../cli-command';

export interface AccountSuspendArgs {
  readonly accountId: string;
  readonly reason: string;
}

export const accountSuspendCommand: CliCommand<AccountSuspendArgs> = {
  usage: 'npm run -s account:suspend -- --account <id> --reason "<why, as told to the owner>"',

  parse(argv) {
    const values = parseCommandArgs(argv, {
      account: { type: 'string' },
      reason: { type: 'string' },
    });
    const reason = requiredText(values, 'reason').trim();
    if (reason.length > MAX_SUSPENSION_REASON_LENGTH) {
      throw new CliUsageError(
        `--reason holds at most ${String(MAX_SUSPENSION_REASON_LENGTH)} characters.`,
      );
    }
    return { accountId: requiredId(values, 'account'), reason };
  },

  async execute(context, args, output) {
    const account = await context.suspendAccount.execute(args);
    output.stdout(`account_id=${account.id}`);
    output.stdout(`status=${account.status}`);
    output.stdout(`suspended_at=${account.suspendedAt.toISOString()}`);
    output.stdout(`suspension_reason=${account.suspensionReason}`);
    output.stderr(
      'Within a minute its projects stop taking events and opening in the dashboard. ' +
        'E-mail the owner the reason and how to contest it; `account:resume` lifts it.',
    );
  },
};
