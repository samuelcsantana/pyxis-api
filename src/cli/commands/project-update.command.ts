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
  readonly name?: string;
  readonly origins?: readonly string[];
  readonly timezone?: string;
  readonly conversionEvent?: string | null;
  readonly cityEnabled?: boolean;
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

function cityChange(values: Parameters<typeof flag>[0]): boolean | undefined {
  const on = flag(values, 'city-on');
  const off = flag(values, 'city-off');
  if (on && off) {
    throw new CliUsageError('Use either --city-on or --city-off.');
  }
  if (on) {
    return true;
  }
  return off ? false : undefined;
}

const CITY_ON_NOTICE =
  "New events keep the visitor's approximate city from now on: the site's privacy notice " +
  'must say so before this is turned on.';
const CITY_OFF_NOTICE =
  'The city is no longer read; the daily job erases the cities already kept at its next run ' +
  '(`jobs:run` starts one now).';

export const projectUpdateCommand: CliCommand<ProjectUpdateArgs> = {
  usage:
    'npm run -s project:update -- --project <id> [--name <name>] [--origin <origin>…] ' +
    '[--timezone <IANA zone>] [--conversion-event <event name> | --clear-conversion-event] ' +
    '[--city-on | --city-off]',

  parse(argv) {
    const values = parseCommandArgs(argv, {
      project: { type: 'string' },
      name: { type: 'string' },
      origin: { type: 'string', multiple: true },
      timezone: { type: 'string' },
      'conversion-event': { type: 'string' },
      'clear-conversion-event': { type: 'boolean' },
      'city-on': { type: 'boolean' },
      'city-off': { type: 'boolean' },
    });
    const name = optionalText(values, 'name');
    const origins = textList(values, 'origin');
    const timezone = optionalText(values, 'timezone');
    const conversionEvent = conversionEventChange(values);
    const cityEnabled = cityChange(values);
    const args: ProjectUpdateArgs = {
      projectId: requiredId(values, 'project'),
      ...(name === undefined ? {} : { name }),
      ...(origins.length === 0 ? {} : { origins }),
      ...(timezone === undefined ? {} : { timezone }),
      ...(conversionEvent === undefined ? {} : { conversionEvent }),
      ...(cityEnabled === undefined ? {} : { cityEnabled }),
    };
    if (Object.keys(args).length === 1) {
      throw new CliUsageError('Give at least one setting to change.');
    }
    return args;
  },

  async execute(context, args, output) {
    const project = await context.updateProject.execute({
      projectId: args.projectId,
      ...(args.name === undefined ? {} : { name: args.name }),
      ...(args.origins === undefined ? {} : { allowedOrigins: args.origins }),
      ...(args.timezone === undefined ? {} : { timezone: args.timezone }),
      ...(args.conversionEvent === undefined ? {} : { conversionEvent: args.conversionEvent }),
      ...(args.cityEnabled === undefined ? {} : { cityEnabled: args.cityEnabled }),
    });
    output.stdout(`project_id=${project.id}`);
    output.stdout(`name=${project.name}`);
    output.stdout(`allowed_origins=${project.allowedOrigins.join(',')}`);
    output.stdout(`timezone=${project.timezone}`);
    output.stdout(`conversion_event=${project.conversionEvent ?? ''}`);
    output.stdout(`city_enabled=${String(project.cityEnabled)}`);
    if (args.cityEnabled !== undefined) {
      output.stderr(args.cityEnabled ? CITY_ON_NOTICE : CITY_OFF_NOTICE);
    }
  },
};
