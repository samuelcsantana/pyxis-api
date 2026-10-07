import type { ProjectActivity, ProjectActivityQuery } from '../domain/queries/project-activity';

export class StubProjectActivityQuery implements ProjectActivityQuery {
  readonly asked: (readonly string[])[] = [];
  readonly activity = new Map<string, ProjectActivity>();

  activityOf(projectIds: readonly string[]): Promise<ReadonlyMap<string, ProjectActivity>> {
    this.asked.push(projectIds);
    return Promise.resolve(this.activity);
  }
}
