export interface ProjectRestrictions {
  readonly ingestionSuspendedAt: Date | null;
  readonly ingestionSuspensionReason: string | null;
  readonly deletionHeldAt: Date | null;
}

export const NO_RESTRICTIONS: ProjectRestrictions = {
  ingestionSuspendedAt: null,
  ingestionSuspensionReason: null,
  deletionHeldAt: null,
};

export interface ProjectRestrictionsQuery {
  restrictionsOf(
    adminUserId: string,
    projectIds: readonly string[],
  ): Promise<ReadonlyMap<string, ProjectRestrictions>>;
}

export const PROJECT_RESTRICTIONS_QUERY = Symbol('ProjectRestrictionsQuery');
