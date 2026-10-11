import type {
  ProjectIcon,
  ProjectIconRepository,
  ProjectSite,
} from '../domain/repositories/project-icon.repository';

export class InMemoryProjectIconRepository implements ProjectIconRepository {
  private readonly icons = new Map<string, ProjectIcon>();

  constructor(private readonly projectSites: readonly ProjectSite[] = []) {}

  get stored(): readonly ProjectIcon[] {
    return [...this.icons.values()];
  }

  sites(): Promise<readonly ProjectSite[]> {
    return Promise.resolve(this.projectSites);
  }

  find(projectId: string): Promise<ProjectIcon | null> {
    return Promise.resolve(this.icons.get(projectId) ?? null);
  }

  save(icon: ProjectIcon): Promise<void> {
    this.icons.set(icon.projectId, icon);
    return Promise.resolve();
  }

  remove(projectId: string): Promise<void> {
    this.icons.delete(projectId);
    return Promise.resolve();
  }

  versionsOf(projectIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
    return Promise.resolve(
      new Map(
        projectIds.flatMap((projectId) => {
          const icon = this.icons.get(projectId);
          return icon === undefined ? [] : [[projectId, icon.version] as const];
        }),
      ),
    );
  }
}
