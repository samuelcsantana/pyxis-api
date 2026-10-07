export interface ProjectActivity {
  readonly firstEventAt: Date | null;
  readonly lastEventAt: Date | null;
}

export const NO_ACTIVITY: ProjectActivity = { firstEventAt: null, lastEventAt: null };

export interface ProjectActivityQuery {
  activityOf(projectIds: readonly string[]): Promise<ReadonlyMap<string, ProjectActivity>>;
}

export const PROJECT_ACTIVITY_QUERY = Symbol('ProjectActivityQuery');
