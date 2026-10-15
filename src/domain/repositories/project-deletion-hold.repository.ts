export interface ProjectDeletionHold {
  readonly projectId: string;
  readonly projectName: string;
  readonly heldAt: Date | null;
  readonly reason: string | null;
}

export interface ProjectDeletionHoldRepository {
  holdOf(projectId: string): Promise<ProjectDeletionHold | null>;
  hold(projectId: string, reason: string, at: Date): Promise<ProjectDeletionHold | null>;
  release(projectId: string): Promise<ProjectDeletionHold | null>;
}

export const PROJECT_DELETION_HOLD_REPOSITORY = Symbol('ProjectDeletionHoldRepository');
