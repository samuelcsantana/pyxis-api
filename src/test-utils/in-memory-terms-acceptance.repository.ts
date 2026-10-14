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
}
