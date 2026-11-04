import { PlanRequiredError } from '../errors/account.errors';
import { ACCOUNT_STATUSES, type AccountStatus } from './account-status';
import { mayUseProFeatures, PRO_FEATURES, requireProFeature } from './pro-features';

function account(status: AccountStatus) {
  return { status };
}

describe('PRO_FEATURES', () => {
  it('names the integrations kept for the Pro plan', () => {
    expect(PRO_FEATURES).toEqual([
      'public_share_link',
      'slack_alerts',
      'annotations_by_token',
      'ga4_import',
      'search_console',
    ]);
  });
});

describe('mayUseProFeatures', () => {
  it.each(['trialing', 'active', 'past_due', 'ending', 'comped'] as const)(
    'lets a %s account use the Pro features',
    (status) => {
      expect(mayUseProFeatures(account(status))).toBe(true);
    },
  );

  it.each(['free', 'incomplete', 'ended'] as const)(
    'keeps a %s account from the Pro features',
    (status) => {
      expect(mayUseProFeatures(account(status))).toBe(false);
    },
  );

  it('decides for every status', () => {
    expect(ACCOUNT_STATUSES.filter((status) => mayUseProFeatures(account(status)))).toHaveLength(5);
  });

  it("lets the operator's own project, outside any account, use them", () => {
    expect(mayUseProFeatures(null)).toBe(true);
  });
});

describe('requireProFeature', () => {
  it.each(PRO_FEATURES)('lets a Pro account use %s', (feature) => {
    expect(() => {
      requireProFeature(account('active'), feature);
    }).not.toThrow();
  });

  it('refuses a free account with plan_required, naming the feature', () => {
    const refusal = (): unknown => {
      try {
        requireProFeature(account('free'), 'slack_alerts');
        return null;
      } catch (error) {
        return error;
      }
    };

    expect(refusal()).toBeInstanceOf(PlanRequiredError);
    expect(refusal()).toMatchObject({ code: 'plan_required', feature: 'slack_alerts' });
  });

  it('takes the use away from an account that leaves Pro, and gives it back when it returns', () => {
    const use = (status: AccountStatus) => (): void => {
      requireProFeature(account(status), 'public_share_link');
    };

    expect(use('active')).not.toThrow();
    expect(use('free')).toThrow(PlanRequiredError);
    expect(use('ended')).toThrow(PlanRequiredError);
    expect(use('active')).not.toThrow();
  });

  it("lets the operator's own project use every Pro feature", () => {
    expect(() => {
      requireProFeature(null, 'ga4_import');
    }).not.toThrow();
  });
});
