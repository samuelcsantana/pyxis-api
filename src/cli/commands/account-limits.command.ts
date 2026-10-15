import {
  exceededLimits,
  MAX_PLAN_LIMITS,
  type PlanLimitChanges,
  type PlanLimitName,
  RESET_LIMITS,
} from '../../domain/accounts/account-limits';
import {
  CliUsageError,
  flag,
  optionalText,
  type ParsedValues,
  parseCommandArgs,
  requiredId,
} from '../cli-args';
import type { CliCommand } from '../cli-command';

export interface AccountLimitsArgs {
  readonly accountId: string;
  readonly changes: PlanLimitChanges;
}

const WHOLE_NUMBER = /^[1-9]\d*$/;

const OPTION_OF: Readonly<Record<PlanLimitName, string>> = {
  eventsPerMonth: 'events',
  projects: 'projects',
  people: 'people',
};

function limitOf(value: string | undefined, name: PlanLimitName): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const limit = Number(value);
  if (!WHOLE_NUMBER.test(value) || limit > MAX_PLAN_LIMITS[name]) {
    throw new CliUsageError(
      `--${OPTION_OF[name]} is a whole number from 1 to ${String(MAX_PLAN_LIMITS[name])}.`,
    );
  }
  return limit;
}

function changesOf(values: ParsedValues): PlanLimitChanges {
  const eventsPerMonthLimit = limitOf(optionalText(values, 'events'), 'eventsPerMonth');
  const projectsLimit = limitOf(optionalText(values, 'projects'), 'projects');
  const peopleLimit = limitOf(optionalText(values, 'people'), 'people');
  return {
    ...(eventsPerMonthLimit === undefined ? {} : { eventsPerMonthLimit }),
    ...(projectsLimit === undefined ? {} : { projectsLimit }),
    ...(peopleLimit === undefined ? {} : { peopleLimit }),
  };
}

export const accountLimitsCommand: CliCommand<AccountLimitsArgs> = {
  usage:
    'npm run -s account:limits -- --account <id> [--events <n>] [--projects <n>] [--people <n>] ' +
    '| --account <id> --reset',

  parse(argv) {
    const values = parseCommandArgs(argv, {
      account: { type: 'string' },
      events: { type: 'string' },
      projects: { type: 'string' },
      people: { type: 'string' },
      reset: { type: 'boolean' },
    });
    const accountId = requiredId(values, 'account');
    const changes = changesOf(values);
    const reset = flag(values, 'reset');
    if ((Object.keys(changes).length === 0) === !reset) {
      throw new CliUsageError('Give --events, --projects and/or --people, or --reset alone.');
    }
    return { accountId, changes: reset ? RESET_LIMITS : changes };
  },

  async execute(context, args, output) {
    await context.setAccountPlanLimits.execute(args);
    const summary = await context.showAccount.execute({ accountId: args.accountId });
    const { limits } = summary;
    output.stdout(`account_id=${summary.account.id}`);
    output.stdout(`events_per_month=${String(limits.eventsPerMonth)}`);
    output.stdout(`projects=${String(summary.projects.length)}/${String(limits.projects)}`);
    output.stdout(`people=${String(summary.people)}/${String(limits.people)}`);
    const over = exceededLimits(limits, {
      events: summary.usage?.events ?? 0,
      projects: summary.projects.length,
      people: summary.people,
    });
    for (const exceeded of over) {
      output.stdout(
        `over_${OPTION_OF[exceeded.limit]}=${String(exceeded.used)}/${String(exceeded.allowed)}`,
      );
    }
    output.stderr(
      over.length === 0
        ? 'The daily measurement and the dashboard use these limits from now on.'
        : 'Nothing is deleted: the account keeps what it has, but cannot add more of what is ' +
            'over until it is back under the limit.',
    );
  },
};
