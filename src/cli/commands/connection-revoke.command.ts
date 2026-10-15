import { parseCommandArgs, requiredId } from '../cli-args';
import type { CliCommand } from '../cli-command';

export interface ConnectionRevokeArgs {
  readonly connectionId: string;
}

export const connectionRevokeCommand: CliCommand<ConnectionRevokeArgs> = {
  usage: 'npm run -s connection:revoke -- --connection <id>',

  parse(argv) {
    const values = parseCommandArgs(argv, { connection: { type: 'string' } });
    return { connectionId: requiredId(values, 'connection') };
  },

  async execute(context, args, output) {
    await context.revokeConnection.execute(args);
    output.stdout(`connection_id=${args.connectionId}`);
    output.stdout('revoked=true');
    output.stderr(
      'The application loses access at once, its tokens included; the person can connect it again.',
    );
  },
};
