import { parseCommandArgs, requiredEmail } from '../cli-args';
import type { CliCommand } from '../cli-command';

export interface AdminByEmailArgs {
  readonly email: string;
}

export const adminSuspendCommand: CliCommand<AdminByEmailArgs> = {
  usage: 'npm run -s admin:suspend -- --email <email>',

  parse(argv) {
    const values = parseCommandArgs(argv, { email: { type: 'string' } });
    return { email: requiredEmail(values, 'email') };
  },

  async execute(context, args, output) {
    const suspended = await context.suspendAdmin.execute(args);
    output.stdout(`admin_user_id=${suspended.adminUserId}`);
    output.stdout(`email=${suspended.email}`);
    output.stdout(`suspended_at=${suspended.suspendedAt.toISOString()}`);
    output.stdout(`sessions_ended=${String(suspended.sessionsEnded)}`);
    output.stdout(`tokens_revoked=${String(suspended.tokensRevoked)}`);
    output.stdout(`connections_revoked=${String(suspended.connectionsRevoked)}`);
    output.stderr(
      'Signed out everywhere, every token revoked and every application disconnected; no ' +
        'sign-in code is sent to this address until `admin:resume`. Their grants are kept.',
    );
  },
};
