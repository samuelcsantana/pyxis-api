export interface ProjectAccountState {
  readonly ingestionPausedUntil: Date | null;
  readonly suspended: boolean;
  readonly ingestionSuspended: boolean;
}

export const UNRESTRICTED_PROJECT: ProjectAccountState = {
  ingestionPausedUntil: null,
  suspended: false,
  ingestionSuspended: false,
};

export interface ProjectAccountStateRepository {
  stateOf(projectId: string): Promise<ProjectAccountState>;
}

export const PROJECT_ACCOUNT_STATE_REPOSITORY = Symbol('ProjectAccountStateRepository');
