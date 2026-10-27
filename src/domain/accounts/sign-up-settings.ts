export interface SignUpSettings {
  readonly open: boolean;
  readonly termsVersion: string | null;
  readonly termsUrl: string | null;
  readonly dashboardOrigin: string | null;
  readonly freePlanOpen: boolean;
  readonly freeAccountsMax: number;
  readonly trialOffered: boolean;
  readonly freePlanTermsForEarlierAccountsFrom: Date | null;
}

export const SIGN_UP_SETTINGS = Symbol('SignUpSettings');
