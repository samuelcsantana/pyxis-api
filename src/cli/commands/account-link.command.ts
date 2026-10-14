import { CliUsageError, parseCommandArgs, requiredId, requiredText } from '../cli-args';
import type { CliCommand } from '../cli-command';

const SUBSCRIPTION_ID_SHAPE = /^sub_[A-Za-z0-9]+$/;

export interface AccountLinkArgs {
  readonly accountId: string;
  readonly subscriptionId: string;
}

function dateOrEmpty(date: Date | null): string {
  return date === null ? '' : date.toISOString();
}

export const accountLinkCommand: CliCommand<AccountLinkArgs> = {
  usage: 'npm run -s account:link -- --account <id> --subscription <sub_…>',

  parse(argv) {
    const values = parseCommandArgs(argv, {
      account: { type: 'string' },
      subscription: { type: 'string' },
    });
    const subscriptionId = requiredText(values, 'subscription');
    if (!SUBSCRIPTION_ID_SHAPE.test(subscriptionId)) {
      throw new CliUsageError('--subscription must be a Stripe subscription id (sub_…).');
    }
    return { accountId: requiredId(values, 'account'), subscriptionId };
  },

  async execute(context, args, output) {
    const update = await context.linkSubscription.execute(args);
    output.stdout(`status=${update.status}`);
    output.stdout(`stripe_customer_id=${update.stripeCustomerId}`);
    output.stdout(`billing_interval=${update.billingInterval ?? ''}`);
    output.stdout(`trial_ends_at=${dateOrEmpty(update.trialEndsAt)}`);
    output.stdout(`current_period_ends_at=${dateOrEmpty(update.currentPeriodEndsAt)}`);
    output.stderr(
      'Linked. Stripe events about this subscription now update the account by its ids.',
    );
  },
};
