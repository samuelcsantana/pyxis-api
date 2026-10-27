import { NO_LIMIT_OVERRIDES } from './account-limits';
import {
  boundByFreePlanTerms,
  fallsBackToFree,
  type FreePlanFallbackPolicy,
  type FreePlanFit,
  fitsFreePlan,
  freePlanFitDueAt,
  isFreePlanTermsVersion,
} from './free-plan-fallback';

const NOW = new Date('2026-12-21T12:00:00.000Z');
const EARLIER_ACCOUNTS_FROM = new Date('2026-12-20T03:00:00.000Z');

const FITTING: FreePlanFit = {
  ...NO_LIMIT_OVERRIDES,
  projects: 1,
  people: 1,
  acceptedTermsVersions: ['1.3'],
  ownerHasAnotherFreeAccount: false,
};

const OPEN: FreePlanFallbackPolicy = {
  freePlanOpen: true,
  freePlanTermsForEarlierAccountsFrom: null,
};

describe('fitsFreePlan', () => {
  it('fits with up to one project and one person, and with none at all', () => {
    expect(fitsFreePlan(FITTING)).toBe(true);
    expect(fitsFreePlan({ ...FITTING, projects: 0, people: 0 })).toBe(true);
  });

  it('does not fit with a second project or a second person', () => {
    expect(fitsFreePlan({ ...FITTING, projects: 2 })).toBe(false);
    expect(fitsFreePlan({ ...FITTING, people: 2 })).toBe(false);
  });

  it('measures against the account’s own limits when the operator set them', () => {
    const widened = { ...FITTING, projectsLimit: 3, peopleLimit: 2 };

    expect(fitsFreePlan({ ...widened, projects: 3, people: 2 })).toBe(true);
    expect(fitsFreePlan({ ...widened, projects: 4, people: 2 })).toBe(false);
    expect(fitsFreePlan({ ...widened, projects: 3, people: 3 })).toBe(false);
  });

  it('ignores an events limit, since the month’s events never keep an account out', () => {
    expect(fitsFreePlan({ ...FITTING, eventsPerMonthLimit: 1 })).toBe(true);
  });
});

describe('isFreePlanTermsVersion', () => {
  it.each(['1.3', '1.4', '1.10', '2.0'])(
    'counts version %s as terms with the free plan',
    (version) => {
      expect(isFreePlanTermsVersion(version)).toBe(true);
    },
  );

  it.each(['1.2', '1.1', '0.9', '2026-11-01', '1.3-draft', ''])(
    'does not count version "%s", so its owner is never held to rules it did not accept',
    (version) => {
      expect(isFreePlanTermsVersion(version)).toBe(false);
    },
  );
});

describe('boundByFreePlanTerms', () => {
  it('binds an owner who accepted terms with the free plan, whatever the date', () => {
    expect(
      boundByFreePlanTerms({ ...FITTING, acceptedTermsVersions: ['1.2', '1.3'] }, OPEN, NOW),
    ).toBe(true);
  });

  it('binds an earlier owner only from the instant the new terms reach earlier accounts', () => {
    const earlier = { ...FITTING, acceptedTermsVersions: ['1.2'] };
    const policy = { ...OPEN, freePlanTermsForEarlierAccountsFrom: EARLIER_ACCOUNTS_FROM };

    expect(boundByFreePlanTerms(earlier, policy, EARLIER_ACCOUNTS_FROM)).toBe(true);
    expect(
      boundByFreePlanTerms(earlier, policy, new Date(EARLIER_ACCOUNTS_FROM.getTime() - 1)),
    ).toBe(false);
  });

  it('does not bind an earlier owner while that instant is not set', () => {
    expect(boundByFreePlanTerms({ ...FITTING, acceptedTermsVersions: ['1.2'] }, OPEN, NOW)).toBe(
      false,
    );
    expect(boundByFreePlanTerms({ ...FITTING, acceptedTermsVersions: [] }, OPEN, NOW)).toBe(false);
  });
});

describe('fallsBackToFree', () => {
  it('falls back when the free plan is open, the terms bind the owner and the account fits', () => {
    expect(fallsBackToFree(FITTING, OPEN, NOW)).toBe(true);
  });

  it('never falls back while the free plan is closed', () => {
    expect(fallsBackToFree(FITTING, { ...OPEN, freePlanOpen: false }, NOW)).toBe(false);
  });

  it('does not fall back when the account does not fit', () => {
    expect(fallsBackToFree({ ...FITTING, projects: 2 }, OPEN, NOW)).toBe(false);
  });

  it('does not fall back while the owner is still bound by earlier terms', () => {
    expect(fallsBackToFree({ ...FITTING, acceptedTermsVersions: ['1.2'] }, OPEN, NOW)).toBe(false);
  });

  it('does not fall back when the owner already has another free account', () => {
    expect(fallsBackToFree({ ...FITTING, ownerHasAnotherFreeAccount: true }, OPEN, NOW)).toBe(
      false,
    );
  });
});

describe('freePlanFitDueAt', () => {
  it('gives thirty days to fit', () => {
    expect(freePlanFitDueAt(NOW)).toEqual(new Date('2027-01-20T12:00:00.000Z'));
  });
});
