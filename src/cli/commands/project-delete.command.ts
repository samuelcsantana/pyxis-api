import { parseCommandArgs, requiredId, requiredText } from '../cli-args';
import type { CliCommand } from '../cli-command';

export interface ProjectDeleteArgs {
  readonly projectId: string;
  readonly confirmName: string;
}

export const projectDeleteCommand: CliCommand<ProjectDeleteArgs> = {
  usage: 'npm run -s project:delete -- --project <id> --confirm-name <the project name, exactly>',

  parse(argv) {
    const values = parseCommandArgs(argv, {
      project: { type: 'string' },
      'confirm-name': { type: 'string' },
    });
    return {
      projectId: requiredId(values, 'project'),
      confirmName: requiredText(values, 'confirm-name'),
    };
  },

  async execute(context, args, output) {
    const deleted = await context.deleteProject.execute(args);
    output.stdout(`project_id=${deleted.project.id}`);
    output.stdout(`name=${deleted.project.name}`);
    output.stdout(`deleted_events=${String(deleted.deletedEvents)}`);
    output.stdout(`deleted_keys=${String(deleted.deletedKeys)}`);
  },
};
