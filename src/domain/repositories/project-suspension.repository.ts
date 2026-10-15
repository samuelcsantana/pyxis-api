export interface ProjectIngestionSuspension {
  readonly projectId: string;
  readonly projectName: string;
  readonly suspendedAt: Date | null;
  readonly reason: string | null;
}

export interface ProjectSuspensionRepository {
  suspensionOf(projectId: string): Promise<ProjectIngestionSuspension | null>;
  suspend(projectId: string, reason: string, at: Date): Promise<ProjectIngestionSuspension | null>;
  resume(projectId: string): Promise<ProjectIngestionSuspension | null>;
}

export const PROJECT_SUSPENSION_REPOSITORY = Symbol('ProjectSuspensionRepository');
