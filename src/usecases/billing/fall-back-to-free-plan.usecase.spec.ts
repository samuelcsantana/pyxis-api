import { Logger } from '@nestjs/common';
import { NO_LIMIT_OVERRIDES } from '../../domain/accounts/account-limits';
import type { AccountStatus } from '../../domain/accounts/account-status';
import type { SignUpSettings } from '../../domain/accounts/sign-up-settings';
import type { AccountBillingUpdate } from '../../domain/billing/account-billing';
import { FixedClock } from '../../test-utils/fixed-clock';
import {
  type FallbackAccount,
  InMemoryFreePlanFallbackRepository,
} from '../../test-utils/in-memory-free-plan-fallback.repository';
import { RecordingMailSender } from '../../test-utils/recording-mail-sender';
import { FallBackToFreePlanUseCase } from './fall-back-to-free-plan.usecase';

const NOW = new Date('2026-12-21T12:00:00.000Z');
const ACCOUNT_ID = 'acc00000-0000-4000-a000-000000000001';
const OTHER_ID = 'acc00000-0000-4000-a000-000000000002';

const SETTINGS: SignUpSettings = {
  open: true,
  termsVersion: '1.3',
  termsUrl: 'https://example.com/termos',
  dashboardOrigin: 'https://app.example.com',
  freePlanOpen: true,
  freeAccountsMax: 200,
  trialOffered: false,
  freePlanTermsForEarlierAccountsFrom: null,
};

const ENDING: FallbackAccount = {
  accountId: ACCOUNT_ID,
  ownerEmail: 'ana@example.com',
  ownerLanguage: 'pt-BR',
  eventsPerMonthLimit: null,
  status: 'ending',
  fit: {
    ...NO_LIMIT_OVERRIDES,
    projects: 1,
    people: 1,
    acceptedTermsVersions: ['1.3'],
    ownerHasAnotherFreeAccount: false,
  },
};

const ENDED_UPDATE: AccountBillingUpdate = {
  status: 'ended',
  stripeCustomerId: 'cus_1',
  stripeSubscriptionId: 'sub_1',
  billingInterval: 'month',
  trialEndsAt: null,
  currentPeriodEndsAt: NOW,
  accessEndsAt: NOW,
  restoresAccess: false,
  leavesFreePlan: null,
};

function stateOf(status: AccountStatus) {
  return { accountId: ACCOUNT_ID, status, accessEndsAt: null };
}

function setup(settings: SignUpSettings = SETTINGS) {
  const fallbacks = new InMemoryFreePlanFallbackRepository();
  const mail = new RecordingMailSender();
  const useCase = new FallBackToFreePlanUseCase(fallbacks, mail, new FixedClock(NOW), settings);
  return { fallbacks, mail, useCase };
}

describe('FallBackToFreePlanUseCase', () => {
  let error: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('puts an ended subscription that fits back on free and tells the owner the monthly events', async () => {
    const { fallbacks, mail, useCase } = setup();
    fallbacks.add(ENDING);

    expect(await useCase.tryFallBack(stateOf('ending'), ENDED_UPDATE)).toBe(true);

    expect(fallbacks.fellBack).toEqual([{ accountId: ACCOUNT_ID, at: NOW }]);
    expect(fallbacks.statusOf(ACCOUNT_ID)).toBe('free');
    expect(mail.accountNotices).toEqual([
      {
        email: 'ana@example.com',
        notice: { kind: 'back_to_free', eventsPerMonth: 10_000 },
        language: 'pt-BR',
      },
    ]);
    expect(fallbacks.isNoticeDue(ACCOUNT_ID)).toBe(false);
  });

  it('names the account’s own monthly limit when the operator set one', async () => {
    const { fallbacks, mail, useCase } = setup();
    fallbacks.add({ ...ENDING, eventsPerMonthLimit: 25_000 });

    await useCase.tryFallBack(stateOf('past_due'), ENDED_UPDATE);

    expect(mail.accountNotices[0]?.notice).toEqual({
      kind: 'back_to_free',
      eventsPerMonth: 25_000,
    });
  });

  it('does nothing while the free plan is closed', async () => {
    const { fallbacks, useCase } = setup({ ...SETTINGS, freePlanOpen: false });
    fallbacks.add(ENDING);

    expect(await useCase.tryFallBack(stateOf('ending'), ENDED_UPDATE)).toBe(false);
    expect(fallbacks.statusOf(ACCOUNT_ID)).toBe('ending');
  });

  it('only moves a running subscription that ends, never one that keeps running or never ran', async () => {
    const { fallbacks, useCase } = setup();
    fallbacks.add(ENDING);

    expect(
      await useCase.tryFallBack(stateOf('ending'), { ...ENDED_UPDATE, status: 'active' }),
    ).toBe(false);
    expect(await useCase.tryFallBack(stateOf('incomplete'), ENDED_UPDATE)).toBe(false);
    expect(await useCase.tryFallBack(stateOf('ended'), ENDED_UPDATE)).toBe(false);
    expect(fallbacks.fellBack).toEqual([]);
  });

  it('leaves the account to end when it does not fit, is unknown, or the owner is held to earlier terms', async () => {
    const { fallbacks, useCase } = setup();
    fallbacks.add({ ...ENDING, fit: { ...ENDING.fit, projects: 2 } });
    fallbacks.add({
      ...ENDING,
      accountId: OTHER_ID,
      fit: { ...ENDING.fit, acceptedTermsVersions: ['1.2'] },
    });

    expect(await useCase.tryFallBack(stateOf('ending'), ENDED_UPDATE)).toBe(false);
    expect(
      await useCase.tryFallBack({ ...stateOf('ending'), accountId: OTHER_ID }, ENDED_UPDATE),
    ).toBe(false);
    expect(
      await useCase.tryFallBack({ ...stateOf('ending'), accountId: 'unknown' }, ENDED_UPDATE),
    ).toBe(false);
    expect(fallbacks.fellBack).toEqual([]);
  });

  it('sends nothing when the account stopped running before the move, such as closed meanwhile', async () => {
    const { fallbacks, mail, useCase } = setup();
    fallbacks.add({ ...ENDING, status: 'ended' });

    expect(await useCase.tryFallBack(stateOf('ending'), ENDED_UPDATE)).toBe(false);

    expect(mail.accountNotices).toEqual([]);
  });

  it('keeps the fall back when the e-mail fails, with the notice still due and the failure logged', async () => {
    const { fallbacks, mail, useCase } = setup();
    fallbacks.add(ENDING);
    mail.failFor('ana@example.com', new Error('provider down'));

    expect(await useCase.tryFallBack(stateOf('ending'), ENDED_UPDATE)).toBe(true);

    expect(fallbacks.isNoticeDue(ACCOUNT_ID)).toBe(true);
    expect(error).toHaveBeenCalledWith({
      message: 'accounts.notice_failed',
      kind: 'back_to_free',
      accountId: ACCOUNT_ID,
      reason: 'Error: provider down',
    });
  });

  it('sends every notice still due on the daily run, counting those sent', async () => {
    const { fallbacks, mail, useCase } = setup();
    fallbacks.add(ENDING);
    fallbacks.add({ ...ENDING, accountId: OTHER_ID, ownerEmail: 'bia@example.com' });
    mail.failFor('ana@example.com', new Error('provider down'));
    mail.failFor('bia@example.com', new Error('provider down'));
    await useCase.tryFallBack(stateOf('ending'), ENDED_UPDATE);
    await useCase.tryFallBack({ ...stateOf('ending'), accountId: OTHER_ID }, ENDED_UPDATE);
    const dailyMail = new RecordingMailSender();
    dailyMail.failFor('bia@example.com', new Error('provider down'));
    const daily = new FallBackToFreePlanUseCase(
      fallbacks,
      dailyMail,
      new FixedClock(NOW),
      SETTINGS,
    );

    expect(await daily.notifyPending()).toBe(1);

    expect(dailyMail.accountNotices.map(({ email }) => email)).toEqual(['ana@example.com']);
    expect(fallbacks.isNoticeDue(ACCOUNT_ID)).toBe(false);
    expect(fallbacks.isNoticeDue(OTHER_ID)).toBe(true);
  });

  it('sends no notice to an account that is not due one', async () => {
    const { fallbacks, mail, useCase } = setup();
    fallbacks.add({ ...ENDING, status: 'free' });

    expect(await useCase.tryNotify(ACCOUNT_ID)).toBe(false);
    expect(mail.accountNotices).toEqual([]);
  });
});
