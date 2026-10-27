import type { EnvConfig } from '../../../config/env.schema';
import type { SignUpSettings } from '../../../domain/accounts/sign-up-settings';

export type SignUpEnv = Pick<
  EnvConfig,
  | 'SIGNUP_OPEN'
  | 'TERMS_VERSION'
  | 'TERMS_URL'
  | 'DASHBOARD_ORIGIN'
  | 'FREE_PLAN_OPEN'
  | 'FREE_ACCOUNTS_MAX'
  | 'TRIAL_OFFERED'
  | 'FREE_PLAN_TERMS_FOR_EARLIER_ACCOUNTS_FROM'
>;

export function signUpSettingsFromEnv(env: SignUpEnv): SignUpSettings {
  const termsVersion = env.TERMS_VERSION ?? null;
  const termsUrl = env.TERMS_URL ?? null;
  const earlierAccountsFrom = env.FREE_PLAN_TERMS_FOR_EARLIER_ACCOUNTS_FROM;
  return {
    open: env.SIGNUP_OPEN === 'true' && termsVersion !== null && termsUrl !== null,
    termsVersion,
    termsUrl,
    dashboardOrigin: env.DASHBOARD_ORIGIN ?? null,
    freePlanOpen: env.FREE_PLAN_OPEN === 'true',
    freeAccountsMax: env.FREE_ACCOUNTS_MAX,
    trialOffered: env.TRIAL_OFFERED === 'true',
    freePlanTermsForEarlierAccountsFrom:
      earlierAccountsFrom === undefined ? null : new Date(earlierAccountsFrom),
  };
}
