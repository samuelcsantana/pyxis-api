import { parseCommandArgs, requiredId } from '../cli-args';
import type { CliCommand } from '../cli-command';

export interface AccountResumeArgs {
  readonly accountId: string;
}

export const accountResumeCommand: CliCommand<AccountResumeArgs> = {
  usage: 'npm run -s account:resume -- --account <id>',

  parse(argv) {
    const values = parseCommandArgs(argv, { account: { type: 'string' } });
    return { accountId: requiredId(values, 'account') };
  },

  async execute(context, args, output) {
    const account = await context.resumeAccount.execute(args);
    output.stdout(`account_id=${account.id}`);
    output.stdout(`status=${account.status}`);
    output.stdout('suspended_at=');
    output.stderr(
      'Within a minute its projects take events and open in the dashboard again. ' +
        'Keys and tokens revoked meanwhile stay revoked.',
    );
  },
};
