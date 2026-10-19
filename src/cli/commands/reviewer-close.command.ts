import { parseCommandArgs, requiredEmail } from '../cli-args';
import type { CliCommand } from '../cli-command';

export interface ReviewerCloseArgs {
  readonly email: string;
}

export const reviewerCloseCommand: CliCommand<ReviewerCloseArgs> = {
  usage: 'npm run -s reviewer:close -- --email <email>',

  parse(argv) {
    const values = parseCommandArgs(argv, { email: { type: 'string' } });
    return { email: requiredEmail(values, 'email') };
  },

  async execute(context, args, output) {
    const closed = await context.closeReviewerCode.execute(args);
    output.stdout(`admin_user_id=${closed.adminUserId}`);
    output.stdout(`closed=${String(closed.closed)}`);
    output.stderr(
      closed.closed
        ? 'Closed. The code no longer signs in; sessions it opened stay until they end. The ' +
            'address is e-mailed sign-in codes again.'
        : 'This admin had no reviewer code open.',
    );
  },
};
