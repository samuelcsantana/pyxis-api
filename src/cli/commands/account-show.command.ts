import { parseCommandArgs, requiredId } from '../cli-args';
import type { CliCommand } from '../cli-command';

export interface AccountShowArgs {
  readonly accountId: string;
}

export const accountShowCommand: CliCommand<AccountShowArgs> = {
  usage: 'npm run -s account:show -- --account <id>',

  parse(argv) {
    const values = parseCommandArgs(argv, { account: { type: 'string' } });
    return { accountId: requiredId(values, 'account') };
  },

  async execute(context, args, output) {
    const summary = await context.showAccount.execute(args);
    output.stdout(`account_id=${summary.account.id}`);
    output.stdout(`status=${summary.account.status}`);
    output.stdout(`owner_email=${summary.ownerEmail}`);
    output.stdout(`projects=${String(summary.projects.length)}/${String(summary.limits.projects)}`);
    output.stdout(`people=${String(summary.people)}/${String(summary.limits.people)}`);
    const limit = String(summary.limits.eventsPerMonth);
    output.stdout(
      summary.usage === null
        ? `events_${summary.month}=not measured yet/${limit}`
        : `events_${summary.month}=${String(summary.usage.events)}/${limit}`,
    );
    if (summary.usage !== null) {
      output.stdout(`measured_at=${summary.usage.updatedAt.toISOString()}`);
    }
    const pausedUntil = summary.account.ingestionPausedUntil;
    output.stdout(
      `ingestion_paused_until=${pausedUntil === null ? '' : pausedUntil.toISOString()}`,
    );
    output.stdout(`suspended_at=${summary.account.suspendedAt?.toISOString() ?? ''}`);
    output.stdout(`suspension_reason=${summary.account.suspensionReason ?? ''}`);
    for (const project of summary.projects) {
      output.stdout(`project=${project.id}\t${project.name}`);
    }
  },
};
