import { parseCommandArgs, requiredId } from '../cli-args';
import type { CliCommand } from '../cli-command';

export interface TokenRevokeArgs {
  readonly tokenId: string;
}

export const tokenRevokeCommand: CliCommand<TokenRevokeArgs> = {
  usage: 'npm run -s token:revoke -- --token <id>',

  parse(argv) {
    const values = parseCommandArgs(argv, { token: { type: 'string' } });
    return { tokenId: requiredId(values, 'token') };
  },

  async execute(context, args, output) {
    await context.revokeAccessToken.execute(args);
    output.stdout(`token_id=${args.tokenId}`);
    output.stdout('revoked=true');
    output.stderr('The token stops working at once; tell its admin to create another.');
  },
};
