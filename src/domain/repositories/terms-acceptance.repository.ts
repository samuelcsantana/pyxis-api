export interface TermsAcceptance {
  readonly adminUserId: string;
  readonly accountId: string;
  readonly version: string;
  readonly acceptedAt: Date;
}

export interface TermsAcceptanceRepository {
  record(acceptance: TermsAcceptance): Promise<void>;
}

export const TERMS_ACCEPTANCE_REPOSITORY = Symbol('TermsAcceptanceRepository');
