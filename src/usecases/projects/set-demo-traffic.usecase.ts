import { Inject, Injectable } from '@nestjs/common';
import {
  DemoTrafficInAccountError,
  ProjectNotFoundError,
} from '../../domain/errors/project.errors';
import {
  DEMO_TRAFFIC_REPOSITORY,
  type DemoTrafficProject,
  type DemoTrafficRepository,
} from '../../domain/repositories/demo-traffic.repository';

export interface SetDemoTrafficCommand {
  readonly projectId: string;
  readonly demoTraffic: boolean;
}

@Injectable()
export class SetDemoTrafficUseCase {
  constructor(@Inject(DEMO_TRAFFIC_REPOSITORY) private readonly projects: DemoTrafficRepository) {}

  async execute(command: SetDemoTrafficCommand): Promise<DemoTrafficProject> {
    const project = await this.projects.projectOf(command.projectId);
    if (project === null) {
      throw new ProjectNotFoundError();
    }
    if (command.demoTraffic && project.accountId !== null) {
      throw new DemoTrafficInAccountError();
    }
    const marked = await this.projects.mark(command.projectId, command.demoTraffic);
    if (marked === null) {
      throw new ProjectNotFoundError();
    }
    return marked;
  }
}
