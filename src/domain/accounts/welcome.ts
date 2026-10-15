export interface AcceptedTerms {
  readonly version: string;
  readonly url: string;
}

export interface Welcome {
  readonly trialEndsAt: Date | null;
  readonly terms: AcceptedTerms | null;
}
