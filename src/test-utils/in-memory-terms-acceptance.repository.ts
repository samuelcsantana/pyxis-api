import type {
  TermsAcceptance,
  TermsAcceptanceRepository,
} from '../domain/repositories/terms-acceptance.repository';

export class InMemoryTermsAcceptanceRepository implements TermsAcceptanceRepository {
  readonly recorded: TermsAcceptance[] = [];

  record(acceptance: TermsAcceptance): Promise<void> {
    this.recorded.push(acceptance);
    return Promise.resolve();
  }

  versionsAcceptedFor(accountId: string): Promise<readonly string[]> {
    const versions = this.recorded
      .filter((acceptance) => acceptance.accountId === accountId)
      .map((acceptance) => acceptance.version);
    return Promise.resolve([...new Set(versions)]);
  }
}
