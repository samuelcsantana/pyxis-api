import { PROJECT_KEY_CACHE_TTL_MS } from '../../infra/repositories/caching-project.repository';
import { parseCommandArgs, requiredId } from '../cli-args';
import type { CliCommand } from '../cli-command';

const MILLISECONDS_PER_SECOND = 1_000;

export interface KeyRevokeArgs {
  readonly keyId: string;
}

export const keyRevokeCommand: CliCommand<KeyRevokeArgs> = {
  usage: 'npm run -s key:revoke -- --key-id <id>',

  parse(argv) {
    const values = parseCommandArgs(argv, { 'key-id': { type: 'string' } });
    return { keyId: requiredId(values, 'key-id') };
  },

  async execute(context, args, output) {
    await context.revokeProjectKey.execute(args.keyId);
    output.stdout(`revoked_key_id=${args.keyId}`);
    output.stderr(
      `Revoked. Running API instances may accept the key for up to ` +
        `${String(PROJECT_KEY_CACHE_TTL_MS / MILLISECONDS_PER_SECOND)} seconds from their cache.`,
    );
  },
};
