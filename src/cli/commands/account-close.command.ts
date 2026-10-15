import { REFUND_MODES, type RefundMode } from '../../domain/billing/operator-refund';
import { CliUsageError, parseCommandArgs, requiredId, requiredText } from '../cli-args';
import type { CliCommand } from '../cli-command';

export interface AccountCloseArgs {
  readonly accountId: string;
  readonly reason: string;
  readonly refund: RefundMode;
}

function refundModeOf(value: string): RefundMode {
  const mode = REFUND_MODES.find((known) => known === value);
  if (mode === undefined) {
    throw new CliUsageError(`--refund must be one of ${REFUND_MODES.join(', ')}.`);
  }
  return mode;
}

export const accountCloseCommand: CliCommand<AccountCloseArgs> = {
  usage:
    'npm run -s account:close -- --account <id> --reason "<why, as told to the owner>" ' +
    '--refund <full|prorata|none>',

  parse(argv) {
    const values = parseCommandArgs(argv, {
      account: { type: 'string' },
      reason: { type: 'string' },
      refund: { type: 'string' },
    });
    return {
      accountId: requiredId(values, 'account'),
      reason: requiredText(values, 'reason').trim(),
      refund: refundModeOf(requiredText(values, 'refund')),
    };
  },

  async execute(context, args, output) {
    const closed = await context.closeAccountAsOperator.execute({
      accountId: args.accountId,
      refund: args.refund,
    });
    output.stdout(`account_id=${closed.accountId}`);
    output.stdout('status=ended');
    output.stdout(`access_ended_at=${closed.accessEndsAt.toISOString()}`);
    output.stdout(`deletion_on=${closed.deletionOn.toISOString()}`);
    output.stdout(`subscription_cancelled=${String(closed.subscriptionCancelled)}`);
    output.stdout(`refund=${args.refund}`);
    output.stdout(`refunded_amount=${String(closed.refundedAmount)}`);
    output.stdout(`reason=${args.reason}`);
    output.stderr(
      closed.refundFailed
        ? 'The refund failed (accounts.refund_failed above): refund it by hand in Stripe, then ' +
            'write to the owner with the reason.'
        : 'Keys are revoked; the next daily job e-mails the owner the end of access and the ' +
            'deletion date. Write to the owner with the reason.',
    );
  },
};
