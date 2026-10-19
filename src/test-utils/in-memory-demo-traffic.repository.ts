import type {
  DemoTrafficProject,
  DemoTrafficRepository,
  DemoTrafficTarget,
} from '../domain/repositories/demo-traffic.repository';

interface StoredProject extends DemoTrafficProject {
  readonly timezone: string;
  readonly lastEventAt: Date | null;
}

export class InMemoryDemoTrafficRepository implements DemoTrafficRepository {
  private readonly projects = new Map<string, StoredProject>();

  add(
    project: Pick<DemoTrafficProject, 'projectId' | 'projectName' | 'accountId'> & {
      readonly timezone?: string;
      readonly demoTraffic?: boolean;
      readonly lastEventAt?: Date | null;
    },
  ): void {
    this.projects.set(project.projectId, {
      projectId: project.projectId,
      projectName: project.projectName,
      accountId: project.accountId,
      demoTraffic: project.demoTraffic ?? false,
      timezone: project.timezone ?? 'UTC',
      lastEventAt: project.lastEventAt ?? null,
    });
  }

  projectOf(projectId: string): Promise<DemoTrafficProject | null> {
    return Promise.resolve(this.visible(this.projects.get(projectId)));
  }

  mark(projectId: string, demoTraffic: boolean): Promise<DemoTrafficProject | null> {
    const project = this.projects.get(projectId);
    if (project === undefined) {
      return Promise.resolve(null);
    }
    const marked = { ...project, demoTraffic };
    this.projects.set(projectId, marked);
    return Promise.resolve(this.visible(marked));
  }

  targets(): Promise<readonly DemoTrafficTarget[]> {
    return Promise.resolve(
      [...this.projects.values()]
        .filter((project) => project.demoTraffic)
        .map(({ projectId, timezone, lastEventAt }) => ({ projectId, timezone, lastEventAt })),
    );
  }

  private visible(project: StoredProject | undefined): DemoTrafficProject | null {
    if (project === undefined) {
      return null;
    }
    const { projectId, projectName, accountId, demoTraffic } = project;
    return { projectId, projectName, accountId, demoTraffic };
  }
}
