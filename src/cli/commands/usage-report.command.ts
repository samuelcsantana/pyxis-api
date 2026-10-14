import { optionalText, parseCommandArgs } from '../cli-args';
import type { CliCommand } from '../cli-command';

export interface UsageReportArgs {
  readonly month?: string;
}

const COLUMNS = ['project_id', 'events', 'visits', 'name'] as const;

export const usageReportCommand: CliCommand<UsageReportArgs> = {
  usage: 'npm run -s usage:report -- [--month YYYY-MM]',

  parse(argv) {
    const values = parseCommandArgs(argv, { month: { type: 'string' } });
    const month = optionalText(values, 'month');
    return month === undefined ? {} : { month };
  },

  async execute(context, args, output) {
    const report = await context.reportUsage.execute(args);
    output.stdout(`month=${report.month}`);
    output.stdout(COLUMNS.join('\t'));
    for (const project of report.projects) {
      output.stdout(
        [project.projectId, String(project.events), String(project.visits), project.name].join(
          '\t',
        ),
      );
    }
  },
};
