import {
  DEFAULT_REVIEWER_CODE_DAYS,
  MAX_REVIEWER_CODE_DAYS,
  MAX_REVIEWER_CODE_FAILURES,
} from '../../domain/auth/reviewer-code';
import { CliUsageError, optionalText, parseCommandArgs, requiredEmail } from '../cli-args';
import type { CliCommand } from '../cli-command';

export interface ReviewerOpenArgs {
  readonly email: string;
  readonly days: number;
}

const WHOLE_NUMBER = /^[1-9]\d*$/;

function daysOf(value: string | undefined): number {
  if (value === undefined) {
    return DEFAULT_REVIEWER_CODE_DAYS;
  }
  const days = Number(value);
  if (!WHOLE_NUMBER.test(value) || days > MAX_REVIEWER_CODE_DAYS) {
    throw new CliUsageError(
      `--days is a whole number from 1 to ${String(MAX_REVIEWER_CODE_DAYS)}.`,
    );
  }
  return days;
}

export const reviewerOpenCommand: CliCommand<ReviewerOpenArgs> = {
  usage: 'npm run -s reviewer:open -- --email <email> [--days <n>]',

  parse(argv) {
    const values = parseCommandArgs(argv, { email: { type: 'string' }, days: { type: 'string' } });
    return { email: requiredEmail(values, 'email'), days: daysOf(optionalText(values, 'days')) };
  },

  async execute(context, args, output) {
    const opened = await context.openReviewerCode.execute(args);
    output.stdout(`admin_user_id=${opened.adminUserId}`);
    output.stdout(`email=${opened.email}`);
    output.stdout(`code=${opened.code}`);
    output.stdout(`expires_at=${opened.expiresAt.toISOString()}`);
    output.stderr(
      'Opened, replacing any code this admin had. The code is shown only now: give it to the ' +
        'reviewer with the address. No sign-in code is e-mailed to this address while it is ' +
        `open, and ${String(MAX_REVIEWER_CODE_FAILURES)} wrong codes close it.`,
    );
  },
};
