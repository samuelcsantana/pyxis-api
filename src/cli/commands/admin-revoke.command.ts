import { parseCommandArgs, requiredEmail, requiredId } from '../cli-args';
import type { CliCommand } from '../cli-command';

export interface AdminRevokeArgs {
  readonly email: string;
  readonly projectId: string;
}

export const adminRevokeCommand: CliCommand<AdminRevokeArgs> = {
  usage: 'npm run -s admin:revoke -- --email <email> --project <id>',

  parse(argv) {
    const values = parseCommandArgs(argv, {
      email: { type: 'string' },
      project: { type: 'string' },
    });
    return { email: requiredEmail(values, 'email'), projectId: requiredId(values, 'project') };
  },

  async execute(context, args, output) {
    const revoked = await context.revokeAdminAccess.execute(args);
    output.stdout(`admin_user_id=${revoked.adminUserId}`);
    output.stdout(`project_id=${revoked.projectId}`);
    output.stderr(
      `Revoked. ${revoked.email} no longer reads this project; their sessions stay valid for ` +
        'their other projects.',
    );
  },
};
