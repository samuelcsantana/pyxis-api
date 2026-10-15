import type { EnvConfig } from '../../../config/env.schema';
import type { SignUpSettings } from '../../../domain/accounts/sign-up-settings';

export type SignUpEnv = Pick<
  EnvConfig,
  'SIGNUP_OPEN' | 'TERMS_VERSION' | 'TERMS_URL' | 'DASHBOARD_ORIGIN'
>;

export function signUpSettingsFromEnv(env: SignUpEnv): SignUpSettings {
  const termsVersion = env.TERMS_VERSION ?? null;
  const termsUrl = env.TERMS_URL ?? null;
  return {
    open: env.SIGNUP_OPEN === 'true' && termsVersion !== null && termsUrl !== null,
    termsVersion,
    termsUrl,
    dashboardOrigin: env.DASHBOARD_ORIGIN ?? null,
  };
}
