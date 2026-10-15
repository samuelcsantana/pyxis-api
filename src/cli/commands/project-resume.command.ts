import { parseCommandArgs, requiredId } from '../cli-args';
import type { CliCommand } from '../cli-command';

export interface ProjectResumeArgs {
  readonly projectId: string;
}

export const projectResumeCommand: CliCommand<ProjectResumeArgs> = {
  usage: 'npm run -s project:resume -- --project <id>',

  parse(argv) {
    const values = parseCommandArgs(argv, { project: { type: 'string' } });
    return { projectId: requiredId(values, 'project') };
  },

  async execute(context, args, output) {
    const resumed = await context.resumeProjectIngestion.execute(args);
    output.stdout(`project_id=${resumed.projectId}`);
    output.stdout(`name=${resumed.projectName}`);
    output.stdout('ingestion_suspended_at=');
    output.stderr('Within a minute the project takes events again.');
  },
};
