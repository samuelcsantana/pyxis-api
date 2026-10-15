import { parseCommandArgs, requiredId } from '../cli-args';
import type { CliCommand } from '../cli-command';

export interface ProjectReleaseArgs {
  readonly projectId: string;
}

export const projectReleaseCommand: CliCommand<ProjectReleaseArgs> = {
  usage: 'npm run -s project:release -- --project <id>',

  parse(argv) {
    const values = parseCommandArgs(argv, { project: { type: 'string' } });
    return { projectId: requiredId(values, 'project') };
  },

  async execute(context, args, output) {
    const released = await context.releaseProjectDeletion.execute(args);
    output.stdout(`project_id=${released.projectId}`);
    output.stdout(`name=${released.projectName}`);
    output.stdout('deletion_held_at=');
    output.stderr(
      'The deletion goes ahead again: the next daily job applies the retention to the project ' +
        'and deletes it with its account if that account ended more than thirty days ago.',
    );
  },
};
