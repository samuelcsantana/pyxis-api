export interface SignUpSettings {
  readonly open: boolean;
  readonly termsVersion: string | null;
  readonly dashboardOrigin: string | null;
}

export const SIGN_UP_SETTINGS = Symbol('SignUpSettings');
