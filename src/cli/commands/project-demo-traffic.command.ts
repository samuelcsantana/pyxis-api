import { flag, parseCommandArgs, requiredId } from '../cli-args';
import type { CliCommand } from '../cli-command';

export interface ProjectDemoTrafficArgs {
  readonly projectId: string;
  readonly demoTraffic: boolean;
}

export const projectDemoTrafficCommand: CliCommand<ProjectDemoTrafficArgs> = {
  usage: 'npm run -s project:demo-traffic -- --project <id> [--off]',

  parse(argv) {
    const values = parseCommandArgs(argv, {
      project: { type: 'string' },
      off: { type: 'boolean' },
    });
    return { projectId: requiredId(values, 'project'), demoTraffic: !flag(values, 'off') };
  },

  async execute(context, args, output) {
    const project = await context.setDemoTraffic.execute(args);
    output.stdout(`project_id=${project.projectId}`);
    output.stdout(`name=${project.projectName}`);
    output.stdout(`demo_traffic=${String(project.demoTraffic)}`);
    output.stderr(
      project.demoTraffic
        ? 'The daily job adds invented visits to this project from its next run (`jobs:run` ' +
            'starts one now): the 90 days before today the first time, then each new day.'
        : 'The daily job adds nothing more to this project; the invented events already there ' +
            'stay until the retention or `project:delete` removes them.',
    );
  },
};
