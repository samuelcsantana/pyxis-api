import type { ProjectAccountsQuery } from '../domain/queries/project-accounts';

export class StubProjectAccountsQuery implements ProjectAccountsQuery {
  readonly asked: (readonly string[])[] = [];
  readonly accounts = new Map<string, string | null>();

  accountsOf(projectIds: readonly string[]): Promise<ReadonlyMap<string, string | null>> {
    this.asked.push(projectIds);
    return Promise.resolve(this.accounts);
  }
}
