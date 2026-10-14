import type { ProjectUsage, ProjectUsageQuery } from '../domain/queries/project-usage';

export class StubProjectUsageQuery implements ProjectUsageQuery {
  readonly asked: { readonly from: Date; readonly to: Date }[] = [];
  usage: readonly ProjectUsage[] = [];

  usageBetween(from: Date, to: Date): Promise<readonly ProjectUsage[]> {
    this.asked.push({ from, to });
    return Promise.resolve(this.usage);
  }
}
