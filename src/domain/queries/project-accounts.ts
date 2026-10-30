export interface ProjectAccountsQuery {
  accountsOf(projectIds: readonly string[]): Promise<ReadonlyMap<string, string | null>>;
}

export const PROJECT_ACCOUNTS_QUERY = Symbol('ProjectAccountsQuery');
