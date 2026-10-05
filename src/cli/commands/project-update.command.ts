import {
  CliUsageError,
  flag,
  optionalText,
  parseCommandArgs,
  requiredId,
  textList,
} from '../cli-args';
import type { CliCommand } from '../cli-command';

export interface ProjectUpdateArgs {
  readonly projectId: string;
  readonly origins?: readonly string[];
  readonly timezone?: string;
  readonly conversionEvent?: string | null;
}

function conversionEventChange(values: Parameters<typeof flag>[0]): string | null | undefined {
  const conversionEvent = optionalText(values, 'conversion-event');
  if (!flag(values, 'clear-conversion-event')) {
    return conversionEvent;
  }
  if (conversionEvent !== undefined) {
    throw new CliUsageError('Use either --conversion-event or --clear-conversion-event.');
  }
  return null;
}

export const projectUpdateCommand: CliCommand<ProjectUpdateArgs> = {
  usage:
    'npm run -s project:update -- --project <id> [--origin <origin>…] [--timezone <IANA zone>] ' +
    '[--conversion-event <event name> | --clear-conversion-event]',

  parse(argv) {
    const values = parseCommandArgs(argv, {
      project: { type: 'string' },
      origin: { type: 'string', multiple: true },
      timezone: { type: 'string' },
      'conversion-event': { type: 'string' },
      'clear-conversion-event': { type: 'boolean' },
    });
    const origins = textList(values, 'origin');
    const timezone = optionalText(values, 'timezone');
    const conversionEvent = conversionEventChange(values);
    const args: ProjectUpdateArgs = {
      projectId: requiredId(values, 'project'),
      ...(origins.length === 0 ? {} : { origins }),
      ...(timezone === undefined ? {} : { timezone }),
      ...(conversionEvent === undefined ? {} : { conversionEvent }),
    };
    if (Object.keys(args).length === 1) {
      throw new CliUsageError('Give at least one setting to change.');
    }
    return args;
  },

  async execute(context, args, output) {
    const project = await context.updateProject.execute({
      projectId: args.projectId,
      ...(args.origins === undefined ? {} : { allowedOrigins: args.origins }),
      ...(args.timezone === undefined ? {} : { timezone: args.timezone }),
      ...(args.conversionEvent === undefined ? {} : { conversionEvent: args.conversionEvent }),
    });
    output.stdout(`project_id=${project.id}`);
    output.stdout(`allowed_origins=${project.allowedOrigins.join(',')}`);
    output.stdout(`timezone=${project.timezone}`);
    output.stdout(`conversion_event=${project.conversionEvent ?? ''}`);
  },
};
