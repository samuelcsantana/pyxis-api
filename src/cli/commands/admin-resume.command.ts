import { parseCommandArgs, requiredEmail } from '../cli-args';
import type { CliCommand } from '../cli-command';
import type { AdminByEmailArgs } from './admin-suspend.command';

export const adminResumeCommand: CliCommand<AdminByEmailArgs> = {
  usage: 'npm run -s admin:resume -- --email <email>',

  parse(argv) {
    const values = parseCommandArgs(argv, { email: { type: 'string' } });
    return { email: requiredEmail(values, 'email') };
  },

  async execute(context, args, output) {
    const admin = await context.resumeAdmin.execute(args);
    output.stdout(`admin_user_id=${admin.id}`);
    output.stdout(`email=${admin.email}`);
    output.stdout('suspended_at=');
    output.stderr('They can sign in again; their old sessions and tokens stay ended.');
  },
};
