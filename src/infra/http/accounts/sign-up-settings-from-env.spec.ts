import { signUpSettingsFromEnv } from './sign-up-settings-from-env';

describe('signUpSettingsFromEnv', () => {
  const PUBLISHED = {
    SIGNUP_OPEN: 'true',
    TERMS_VERSION: '2026-11-01',
    TERMS_URL: 'https://example.com/terms',
    DASHBOARD_ORIGIN: 'https://app.example.com',
  } as const;

  it('opens sign-up when the switch is on and the terms are published with their address', () => {
    expect(signUpSettingsFromEnv(PUBLISHED)).toEqual({
      open: true,
      termsVersion: '2026-11-01',
      termsUrl: 'https://example.com/terms',
      dashboardOrigin: 'https://app.example.com',
    });
  });

  it('keeps sign-up closed while no terms version is published, even with the switch on', () => {
    expect(
      signUpSettingsFromEnv({
        SIGNUP_OPEN: 'true',
        TERMS_VERSION: undefined,
        TERMS_URL: undefined,
        DASHBOARD_ORIGIN: undefined,
      }),
    ).toEqual({ open: false, termsVersion: null, termsUrl: null, dashboardOrigin: null });
  });

  it('keeps sign-up closed while the terms have no address', () => {
    expect(signUpSettingsFromEnv({ ...PUBLISHED, TERMS_URL: undefined }).open).toBe(false);
  });

  it('keeps sign-up closed while the switch is off', () => {
    expect(signUpSettingsFromEnv({ ...PUBLISHED, SIGNUP_OPEN: 'false' }).open).toBe(false);
  });
});
