import { parseCommandArgs, requiredEmail } from '../cli-args';
import type { CliCommand } from '../cli-command';

export interface AccountCreateArgs {
  readonly ownerEmail: string;
}

export const accountCreateCommand: CliCommand<AccountCreateArgs> = {
  usage: 'npm run -s account:create -- --owner-email <email>',

  parse(argv) {
    const values = parseCommandArgs(argv, { 'owner-email': { type: 'string' } });
    return { ownerEmail: requiredEmail(values, 'owner-email') };
  },

  async execute(context, args, output) {
    const account = await context.createCompedAccount.execute(args);
    output.stdout(`account_id=${account.accountId}`);
    output.stdout(`owner_admin_id=${account.ownerAdminId}`);
    output.stdout('status=comped');
    output.stderr(
      `Comped account created for ${account.ownerEmail}, on the paid plan's limits. Create its ` +
        'projects with `project:create --account <account_id>`; the owner reads each one.',
    );
  },
};
