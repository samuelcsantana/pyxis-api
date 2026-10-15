import { projectlessDeletionThreshold } from '../../domain/people/projectless-people';
import type { ProjectlessPeopleRepository } from '../../domain/repositories/projectless-people.repository';
import type { Clock } from '../../domain/services/clock';

export interface ProjectlessSweep {
  readonly projectlessMarked: number;
  readonly projectlessRemoved: number;
}

export class SweepProjectlessPeopleUseCase {
  constructor(
    private readonly people: ProjectlessPeopleRepository,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<ProjectlessSweep> {
    const now = this.clock.now();
    await this.people.clearReturned();
    const projectlessMarked = await this.people.markProjectless(now);
    const projectlessRemoved = await this.people.deleteProjectlessSince(
      projectlessDeletionThreshold(now),
    );
    return { projectlessMarked, projectlessRemoved };
  }
}
