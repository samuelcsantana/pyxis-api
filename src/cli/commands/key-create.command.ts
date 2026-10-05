import { CliUsageError, parseCommandArgs, requiredId, requiredText } from '../cli-args';
import type { CliCommand } from '../cli-command';

const KEY_KINDS = ['public', 'secret'] as const;

export interface KeyCreateArgs {
  readonly projectId: string;
  readonly kind: (typeof KEY_KINDS)[number];
}

function isKeyKind(value: string): value is KeyCreateArgs['kind'] {
  return (KEY_KINDS as readonly string[]).includes(value);
}

export const keyCreateCommand: CliCommand<KeyCreateArgs> = {
  usage: 'npm run -s key:create -- --project <id> --kind <public|secret>',

  parse(argv) {
    const values = parseCommandArgs(argv, {
      project: { type: 'string' },
      kind: { type: 'string' },
    });
    const kind = requiredText(values, 'kind');
    if (!isKeyKind(kind)) {
      throw new CliUsageError('--kind must be public or secret.');
    }
    return { projectId: requiredId(values, 'project'), kind };
  },

  async execute(context, args, output) {
    const created = await context.createProjectKey.execute(args);
    output.stdout(created.key);
    output.stderr(
      created.kind === 'secret'
        ? `Secret key ${created.keyId} created. It is shown only now and stored as a hash.`
        : `Public key ${created.keyId} created.`,
    );
  },
};
