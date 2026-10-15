import { CliUsageError, flag, optionalText, parseCommandArgs, requiredId } from '../cli-args';
import type { CliCommand } from '../cli-command';

export interface AccountExemptQuotaArgs {
  readonly accountId: string;
  readonly until: Date | null;
}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function dayOf(value: string): Date {
  const day = new Date(`${value}T00:00:00.000Z`);
  if (
    !DAY_PATTERN.test(value) ||
    Number.isNaN(day.getTime()) ||
    day.toISOString().slice(0, 10) !== value
  ) {
    throw new CliUsageError('--until is a day written YYYY-MM-DD.');
  }
  return day;
}

export const accountExemptQuotaCommand: CliCommand<AccountExemptQuotaArgs> = {
  usage:
    'npm run -s account:exempt-quota -- --account <id> --until <YYYY-MM-DD> ' +
    '| --account <id> --clear',

  parse(argv) {
    const values = parseCommandArgs(argv, {
      account: { type: 'string' },
      until: { type: 'string' },
      clear: { type: 'boolean' },
    });
    const accountId = requiredId(values, 'account');
    const until = optionalText(values, 'until');
    const clear = flag(values, 'clear');
    if ((until === undefined) === !clear) {
      throw new CliUsageError('Give either --until <YYYY-MM-DD> or --clear.');
    }
    return { accountId, until: until === undefined ? null : dayOf(until) };
  },

  async execute(context, args, output) {
    const account = await context.exemptAccountFromQuotaPause.execute(args);
    const until = account.quotaPauseExemptUntil;
    output.stdout(`account_id=${account.id}`);
    output.stdout(`quota_pause_exempt_until=${until === null ? '' : until.toISOString()}`);
    output.stderr(
      until === null
        ? 'The exemption is over: the next daily measurement pauses the account again if it ' +
            'is past 150% of the plan.'
        : 'Within a minute a pause in place is lifted; until that day the daily measurement ' +
            'neither pauses the account nor tells its owner of a pause.',
    );
  },
};
