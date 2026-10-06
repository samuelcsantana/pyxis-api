import { parseCommandArgs, requiredEmail, requiredId } from '../cli-args';
import type { CliCommand } from '../cli-command';

export interface AdminGrantArgs {
  readonly email: string;
  readonly projectId: string;
}

export const adminGrantCommand: CliCommand<AdminGrantArgs> = {
  usage: 'npm run -s admin:grant -- --email <email> --project <id>',

  parse(argv) {
    const values = parseCommandArgs(argv, {
      email: { type: 'string' },
      project: { type: 'string' },
    });
    return { email: requiredEmail(values, 'email'), projectId: requiredId(values, 'project') };
  },

  async execute(context, args, output) {
    const grant = await context.grantAdminAccess.execute(args);
    output.stdout(`admin_user_id=${grant.adminUserId}`);
    output.stdout(`project_id=${grant.projectId}`);
    output.stderr(
      `Granted. ${grant.email} can now ask the dashboard for a sign-in code and read this project.`,
    );
  },
};
