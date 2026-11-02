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
  readonly visitorsEnabled?: boolean;
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

function switchChange(
  values: Parameters<typeof flag>[0],
  onFlag: string,
  offFlag: string,
): boolean | undefined {
  const on = flag(values, onFlag);
  const off = flag(values, offFlag);
  if (on && off) {
    throw new CliUsageError(`Use either --${onFlag} or --${offFlag}.`);
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
const VISITORS_ON_NOTICE =
  'New events keep the kind of visit the tracker sends, and each answer tells the browser when ' +
  "the site's day and month end (within a minute, the project lookup is cached): the site's " +
  'privacy notice must say so before this is turned on.';
const VISITORS_OFF_NOTICE =
  'New events no longer keep the kind of visit (within a minute); the tracker deletes its ' +
  'marker on its next answer. The kinds already kept stay: they are not personal data.';

export const projectUpdateCommand: CliCommand<ProjectUpdateArgs> = {
  usage:
    'npm run -s project:update -- --project <id> [--name <name>] [--origin <origin>…] ' +
    '[--timezone <IANA zone>] [--conversion-event <event name> | --clear-conversion-event] ' +
    '[--city-on | --city-off] [--visitors-on | --visitors-off]',

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
      'visitors-on': { type: 'boolean' },
      'visitors-off': { type: 'boolean' },
    });
    const name = optionalText(values, 'name');
    const origins = textList(values, 'origin');
    const timezone = optionalText(values, 'timezone');
    const conversionEvent = conversionEventChange(values);
    const cityEnabled = switchChange(values, 'city-on', 'city-off');
    const visitorsEnabled = switchChange(values, 'visitors-on', 'visitors-off');
    const args: ProjectUpdateArgs = {
      projectId: requiredId(values, 'project'),
      ...(name === undefined ? {} : { name }),
      ...(origins.length === 0 ? {} : { origins }),
      ...(timezone === undefined ? {} : { timezone }),
      ...(conversionEvent === undefined ? {} : { conversionEvent }),
      ...(cityEnabled === undefined ? {} : { cityEnabled }),
      ...(visitorsEnabled === undefined ? {} : { visitorsEnabled }),
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
      ...(args.visitorsEnabled === undefined ? {} : { visitorsEnabled: args.visitorsEnabled }),
    });
    output.stdout(`project_id=${project.id}`);
    output.stdout(`name=${project.name}`);
    output.stdout(`allowed_origins=${project.allowedOrigins.join(',')}`);
    output.stdout(`timezone=${project.timezone}`);
    output.stdout(`conversion_event=${project.conversionEvent ?? ''}`);
    output.stdout(`city_enabled=${String(project.cityEnabled)}`);
    output.stdout(`visitors_enabled=${String(project.visitorsEnabled)}`);
    if (args.cityEnabled !== undefined) {
      output.stderr(args.cityEnabled ? CITY_ON_NOTICE : CITY_OFF_NOTICE);
    }
    if (args.visitorsEnabled !== undefined) {
      output.stderr(args.visitorsEnabled ? VISITORS_ON_NOTICE : VISITORS_OFF_NOTICE);
    }
  },
};
