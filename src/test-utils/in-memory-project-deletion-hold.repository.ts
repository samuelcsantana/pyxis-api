import type {
  ProjectDeletionHold,
  ProjectDeletionHoldRepository,
} from '../domain/repositories/project-deletion-hold.repository';

export class InMemoryProjectDeletionHoldRepository implements ProjectDeletionHoldRepository {
  private readonly holds = new Map<string, ProjectDeletionHold>();

  add(projectId: string, projectName: string): void {
    this.holds.set(projectId, { projectId, projectName, heldAt: null, reason: null });
  }

  holdOf(projectId: string): Promise<ProjectDeletionHold | null> {
    return Promise.resolve(this.holds.get(projectId) ?? null);
  }

  hold(projectId: string, reason: string, at: Date): Promise<ProjectDeletionHold | null> {
    return Promise.resolve(this.update(projectId, { heldAt: at, reason }));
  }

  release(projectId: string): Promise<ProjectDeletionHold | null> {
    return Promise.resolve(this.update(projectId, { heldAt: null, reason: null }));
  }

  private update(
    projectId: string,
    changes: Pick<ProjectDeletionHold, 'heldAt' | 'reason'>,
  ): ProjectDeletionHold | null {
    const hold = this.holds.get(projectId);
    if (hold === undefined) {
      return null;
    }
    const updated = { ...hold, ...changes };
    this.holds.set(projectId, updated);
    return updated;
  }
}
