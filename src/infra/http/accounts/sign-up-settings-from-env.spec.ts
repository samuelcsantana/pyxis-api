import { signUpSettingsFromEnv } from './sign-up-settings-from-env';

describe('signUpSettingsFromEnv', () => {
  it('opens sign-up when the switch is on and a terms version is published', () => {
    expect(
      signUpSettingsFromEnv({
        SIGNUP_OPEN: 'true',
        TERMS_VERSION: '2026-11-01',
        DASHBOARD_ORIGIN: 'https://app.example.com',
      }),
    ).toEqual({
      open: true,
      termsVersion: '2026-11-01',
      dashboardOrigin: 'https://app.example.com',
    });
  });

  it('keeps sign-up closed while no terms version is published, even with the switch on', () => {
    expect(
      signUpSettingsFromEnv({
        SIGNUP_OPEN: 'true',
        TERMS_VERSION: undefined,
        DASHBOARD_ORIGIN: undefined,
      }),
    ).toEqual({ open: false, termsVersion: null, dashboardOrigin: null });
  });

  it('keeps sign-up closed while the switch is off', () => {
    expect(
      signUpSettingsFromEnv({
        SIGNUP_OPEN: 'false',
        TERMS_VERSION: '2026-11-01',
        DASHBOARD_ORIGIN: 'https://app.example.com',
      }).open,
    ).toBe(false);
  });
});
