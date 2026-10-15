import { parseCommandArgs, requiredId } from '../cli-args';
import type { CliCommand } from '../cli-command';

export interface AccountReleaseArgs {
  readonly accountId: string;
}

export const accountReleaseCommand: CliCommand<AccountReleaseArgs> = {
  usage: 'npm run -s account:release -- --account <id>',

  parse(argv) {
    const values = parseCommandArgs(argv, { account: { type: 'string' } });
    return { accountId: requiredId(values, 'account') };
  },

  async execute(context, args, output) {
    const account = await context.releaseAccountDeletion.execute(args);
    output.stdout(`account_id=${account.id}`);
    output.stdout(`status=${account.status}`);
    output.stdout('deletion_held_at=');
    output.stderr(
      'The deletion goes ahead again: an account ended more than thirty days ago is deleted by ' +
        'the next daily job.',
    );
  },
};
