import { optionalText, parseCommandArgs, requiredText, textList } from '../cli-args';
import type { CliCommand } from '../cli-command';

export interface ProjectCreateArgs {
  readonly name: string;
  readonly origins: readonly string[];
  readonly timezone?: string;
  readonly conversionEvent?: string;
}

export const projectCreateCommand: CliCommand<ProjectCreateArgs> = {
  usage:
    'npm run -s project:create -- --name <name> --origin <origin> [--origin <origin>…] ' +
    '[--timezone <IANA zone>] [--conversion-event <event name>]',

  parse(argv) {
    const values = parseCommandArgs(argv, {
      name: { type: 'string' },
      origin: { type: 'string', multiple: true },
      timezone: { type: 'string' },
      'conversion-event': { type: 'string' },
    });
    const timezone = optionalText(values, 'timezone');
    const conversionEvent = optionalText(values, 'conversion-event');
    return {
      name: requiredText(values, 'name'),
      origins: textList(values, 'origin'),
      ...(timezone === undefined ? {} : { timezone }),
      ...(conversionEvent === undefined ? {} : { conversionEvent }),
    };
  },

  async execute(context, args, output) {
    const created = await context.createProject.execute({
      name: args.name,
      allowedOrigins: args.origins,
      ...(args.timezone === undefined ? {} : { timezone: args.timezone }),
      ...(args.conversionEvent === undefined ? {} : { conversionEvent: args.conversionEvent }),
    });
    output.stdout(`project_id=${created.projectId}`);
    output.stdout(`public_key_id=${created.publicKeyId}`);
    output.stdout(`public_key=${created.publicKey}`);
    output.stderr('Project created. The public key goes in the site, like a Sentry DSN.');
  },
};
