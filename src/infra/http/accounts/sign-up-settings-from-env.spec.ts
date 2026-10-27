import { signUpSettingsFromEnv } from './sign-up-settings-from-env';

describe('signUpSettingsFromEnv', () => {
  const PUBLISHED = {
    SIGNUP_OPEN: 'true',
    TERMS_VERSION: '2026-11-01',
    TERMS_URL: 'https://example.com/terms',
    DASHBOARD_ORIGIN: 'https://app.example.com',
    FREE_PLAN_OPEN: 'false',
    FREE_ACCOUNTS_MAX: 200,
    TRIAL_OFFERED: 'true',
    FREE_PLAN_TERMS_FOR_EARLIER_ACCOUNTS_FROM: undefined,
  } as const;

  it('opens sign-up when the switch is on and the terms are published with their address', () => {
    expect(signUpSettingsFromEnv(PUBLISHED)).toEqual({
      open: true,
      termsVersion: '2026-11-01',
      termsUrl: 'https://example.com/terms',
      dashboardOrigin: 'https://app.example.com',
      freePlanOpen: false,
      freeAccountsMax: 200,
      trialOffered: true,
      freePlanTermsForEarlierAccountsFrom: null,
    });
  });

  it('keeps sign-up closed while no terms version is published, even with the switch on', () => {
    expect(
      signUpSettingsFromEnv({
        SIGNUP_OPEN: 'true',
        TERMS_VERSION: undefined,
        TERMS_URL: undefined,
        DASHBOARD_ORIGIN: undefined,
        FREE_PLAN_OPEN: 'false',
        FREE_ACCOUNTS_MAX: 200,
        TRIAL_OFFERED: 'false',
        FREE_PLAN_TERMS_FOR_EARLIER_ACCOUNTS_FROM: undefined,
      }),
    ).toEqual({
      open: false,
      termsVersion: null,
      termsUrl: null,
      dashboardOrigin: null,
      freePlanOpen: false,
      freeAccountsMax: 200,
      trialOffered: false,
      freePlanTermsForEarlierAccountsFrom: null,
    });
  });

  it('keeps sign-up closed while the terms have no address', () => {
    expect(signUpSettingsFromEnv({ ...PUBLISHED, TERMS_URL: undefined }).open).toBe(false);
  });

  it('opens the free plan when its own switch is on, with the cap it is given', () => {
    expect(
      signUpSettingsFromEnv({ ...PUBLISHED, FREE_PLAN_OPEN: 'true', FREE_ACCOUNTS_MAX: 50 }),
    ).toMatchObject({ freePlanOpen: true, freeAccountsMax: 50 });
  });

  it('keeps the free plan closed while its switch is off', () => {
    expect(signUpSettingsFromEnv(PUBLISHED).freePlanOpen).toBe(false);
  });

  it('reads the moment the free plan terms bind earlier accounts as an instant', () => {
    expect(
      signUpSettingsFromEnv({
        ...PUBLISHED,
        FREE_PLAN_TERMS_FOR_EARLIER_ACCOUNTS_FROM: '2026-12-20T00:00:00-03:00',
      }).freePlanTermsForEarlierAccountsFrom,
    ).toEqual(new Date('2026-12-20T03:00:00.000Z'));
  });

  it('keeps sign-up closed while the switch is off', () => {
    expect(signUpSettingsFromEnv({ ...PUBLISHED, SIGNUP_OPEN: 'false' }).open).toBe(false);
  });
});
