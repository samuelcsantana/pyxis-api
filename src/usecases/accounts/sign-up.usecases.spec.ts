import { Logger } from '@nestjs/common';
import { HOSTED_PLAN_LIMITS, TRIAL_DAYS } from '../../domain/accounts/hosted-plan';
import { SIGN_UP_CODES_PER_DAY } from '../../domain/accounts/sign-up-policy';
import type { SignUpSettings } from '../../domain/accounts/sign-up-settings';
import { sha256Hex } from '../../domain/auth/hashing';
import { MAX_SIGN_IN_CODES_PER_WINDOW, SIGN_IN_CODE_TTL_MS } from '../../domain/auth/sign-in-code';
import type { Account } from '../../domain/entities/account.entity';
import {
  AccountNotFoundError,
  NoBillingYetError,
  SignUpClosedError,
  SubscriptionExistsError,
  TermsOutdatedError,
} from '../../domain/errors/account.errors';
import { InvalidSignInCodeError } from '../../domain/errors/auth.errors';
import { BillingUnavailableError } from '../../domain/errors/billing.errors';
import { FakeBillingGateway } from '../../test-utils/fake-billing-gateway';
import { FixedClock } from '../../test-utils/fixed-clock';
import { InMemoryAccountUsageRepository } from '../../test-utils/in-memory-account-usage.repository';
import { InMemoryAccountRepository } from '../../test-utils/in-memory-account.repository';
import { InMemoryAdminSessionRepository } from '../../test-utils/in-memory-admin-session.repository';
import { InMemoryAdminUserRepository } from '../../test-utils/in-memory-admin-user.repository';
import { InMemoryOtpCodeRepository } from '../../test-utils/in-memory-otp-code.repository';
import { InMemoryTermsAcceptanceRepository } from '../../test-utils/in-memory-terms-acceptance.repository';
import { RecordingMailSender } from '../../test-utils/recording-mail-sender';
import { SequenceRandomSource } from '../../test-utils/sequence-random-source';
import { CompleteSignUpUseCase } from './complete-sign-up.usecase';
import { ListMyAccountsUseCase } from './list-my-accounts.usecase';
import { OpenBillingPortalUseCase } from './open-billing-portal.usecase';
import { RequestSignUpCodeUseCase } from './request-sign-up-code.usecase';
import { StartCheckoutUseCase } from './start-checkout.usecase';

const NOW = new Date('2026-11-02T13:00:00.000Z');
const TERMS = '2026-11-01';
const ORIGIN = 'https://app.example.com';
const EMAIL = 'founder@example.com';
const CLIENT = {
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  clientHints: {},
};
const OPEN: SignUpSettings = { open: true, termsVersion: TERMS, dashboardOrigin: ORIGIN };
const MISSING_ID = 'ffffffff-ffff-4fff-bfff-ffffffffffff';

function setup(settings: SignUpSettings = OPEN) {
  const clock = new FixedClock(NOW);
  const random = new SequenceRandomSource([1, 2, 3, 4, 5, 6]);
  const admins = new InMemoryAdminUserRepository();
  const accounts = new InMemoryAccountRepository(admins);
  const usage = new InMemoryAccountUsageRepository();
  const codes = new InMemoryOtpCodeRepository();
  const sessions = new InMemoryAdminSessionRepository();
  const terms = new InMemoryTermsAcceptanceRepository();
  const mail = new RecordingMailSender();
  const gateway = new FakeBillingGateway();
  return {
    clock,
    admins,
    accounts,
    usage,
    codes,
    sessions,
    terms,
    mail,
    gateway,
    requestCode: new RequestSignUpCodeUseCase(codes, mail, clock, random, settings),
    completeSignUp: new CompleteSignUpUseCase(
      codes,
      admins,
      sessions,
      accounts,
      terms,
      clock,
      random,
      settings,
    ),
    startCheckout: new StartCheckoutUseCase(accounts, gateway, settings),
    openPortal: new OpenBillingPortalUseCase(accounts, gateway, settings),
    listAccounts: new ListMyAccountsUseCase(accounts, usage, clock),
  };
}

async function sentCode(
  requestCode: RequestSignUpCodeUseCase,
  mail: RecordingMailSender,
  email = EMAIL,
): Promise<string> {
  await requestCode.execute(email, 'pt-BR');
  const sent = mail.signUpCodes.at(-1);
  if (sent === undefined) {
    throw new Error('no sign-up code was sent');
  }
  return sent.code;
}

function accountOf(overrides: Partial<Account> & Pick<Account, 'ownerAdminId'>): Account {
  return {
    id: 'acc00000-0000-4000-a000-000000000099',
    status: 'incomplete',
    ingestionPausedUntil: null,
    stripeCustomerId: null,
    billingInterval: null,
    trialEndsAt: null,
    currentPeriodEndsAt: null,
    accessEndsAt: null,
    createdAt: new Date('2026-11-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('RequestSignUpCodeUseCase', () => {
  it('stores a sign-up code for the address and e-mails it in the language asked', async () => {
    const { requestCode, codes, mail } = setup();

    await requestCode.execute(' Founder@Example.com ', 'pt-BR');

    expect(mail.signUpCodes).toEqual([
      { email: EMAIL, code: expect.stringMatching(/^\d{6}$/) as string, language: 'pt-BR' },
    ]);
    expect(mail.sent).toEqual([]);
    expect(codes.stored).toEqual([
      expect.objectContaining({
        email: EMAIL,
        purpose: 'sign_up',
        emailLanguage: 'pt-BR',
        createdAt: NOW,
        expiresAt: new Date(NOW.getTime() + SIGN_IN_CODE_TTL_MS),
        codeHash: sha256Hex(mail.signUpCodes[0]?.code ?? ''),
      }),
    ]);
  });

  it('writes in English when no language is asked for', async () => {
    const { requestCode, mail } = setup();

    await requestCode.execute(EMAIL);

    expect(mail.signUpCodes[0]?.language).toBe('en');
  });

  it('refuses while sign-up is closed and stores nothing', async () => {
    const { requestCode, codes, mail } = setup({ ...OPEN, open: false });

    await expect(requestCode.execute(EMAIL)).rejects.toBeInstanceOf(SignUpClosedError);
    expect(codes.stored).toEqual([]);
    expect(mail.signUpCodes).toEqual([]);
  });

  it('sends nothing more to an address past its codes for the hour, sign-in codes included', async () => {
    const { requestCode, codes, mail } = setup();
    for (let sent = 0; sent < MAX_SIGN_IN_CODES_PER_WINDOW; sent += 1) {
      await codes.create({
        email: EMAIL,
        codeHash: 'hash',
        emailLanguage: 'en',
        purpose: 'sign_in',
        createdAt: NOW,
        expiresAt: NOW,
      });
    }
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    await requestCode.execute(EMAIL);

    expect(mail.signUpCodes).toEqual([]);
    expect(codes.stored).toHaveLength(MAX_SIGN_IN_CODES_PER_WINDOW);
    expect(warn).toHaveBeenCalledWith({ message: 'auth.code_rate_limited', purpose: 'sign_up' });
    warn.mockRestore();
  });

  it('sends nothing once the sign-up codes of the last day reach the daily cap', async () => {
    const { requestCode, codes, mail } = setup();
    for (let sent = 0; sent < SIGN_UP_CODES_PER_DAY; sent += 1) {
      await codes.create({
        email: `someone-${String(sent)}@example.com`,
        codeHash: 'hash',
        emailLanguage: 'en',
        purpose: 'sign_up',
        createdAt: NOW,
        expiresAt: NOW,
      });
    }
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    await requestCode.execute(EMAIL);

    expect(mail.signUpCodes).toEqual([]);
    expect(warn).toHaveBeenCalledWith({
      message: 'auth.sign_up_daily_cap',
      cap: SIGN_UP_CODES_PER_DAY,
    });
    warn.mockRestore();
  });

  it('does not count sign-in codes of other addresses toward the daily cap', async () => {
    const { requestCode, codes, mail } = setup();
    for (let sent = 0; sent < SIGN_UP_CODES_PER_DAY; sent += 1) {
      await codes.create({
        email: `admin-${String(sent)}@example.com`,
        codeHash: 'hash',
        emailLanguage: 'en',
        purpose: 'sign_in',
        createdAt: NOW,
        expiresAt: NOW,
      });
    }

    await requestCode.execute(EMAIL);

    expect(mail.signUpCodes).toHaveLength(1);
  });

  it('keeps the code and logs when the e-mail cannot be sent', async () => {
    const { requestCode, codes, mail } = setup();
    mail.failWith(new Error('provider down'));
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    await requestCode.execute(EMAIL);

    expect(codes.stored).toHaveLength(1);
    expect(error).toHaveBeenCalledWith({
      message: 'auth.sign_up_code_delivery_failed',
      reason: 'Error: provider down',
    });
    error.mockRestore();
  });
});

describe('CompleteSignUpUseCase', () => {
  it('creates the owner, an account waiting for its subscription, the acceptance and a session', async () => {
    const { requestCode, completeSignUp, mail, admins, accounts, terms, sessions, codes } = setup();
    const code = await sentCode(requestCode, mail);

    const signedUp = await completeSignUp.execute({
      email: 'FOUNDER@example.com',
      code,
      termsVersion: TERMS,
      client: CLIENT,
    });

    const owner = await admins.findByEmail(EMAIL);
    expect(owner?.emailLanguage).toBe('pt-BR');
    expect(accounts.stored).toEqual([
      expect.objectContaining({
        id: signedUp.accountId,
        ownerAdminId: owner?.id,
        status: 'incomplete',
      }),
    ]);
    expect(terms.recorded).toEqual([
      { adminUserId: owner?.id, accountId: signedUp.accountId, version: TERMS, acceptedAt: NOW },
    ]);
    expect(signedUp.email).toBe(EMAIL);
    expect(sessions.stored).toEqual([
      expect.objectContaining({ tokenHash: sha256Hex(signedUp.sessionToken) }),
    ]);
    expect(sessions.stored[0]?.session).toEqual(
      expect.objectContaining({
        adminUserId: owner?.id,
        device: { deviceType: 'desktop', browser: 'chrome', os: 'windows' },
      }),
    );
    expect(codes.stored[0]?.usedAt).toEqual(NOW);
  });

  it('gives a returning owner the account they already have, recording the new acceptance', async () => {
    const { requestCode, completeSignUp, mail, accounts, terms } = setup();
    const first = await completeSignUp.execute({
      email: EMAIL,
      code: await sentCode(requestCode, mail),
      termsVersion: TERMS,
      client: CLIENT,
    });

    const second = await completeSignUp.execute({
      email: EMAIL,
      code: await sentCode(requestCode, mail),
      termsVersion: TERMS,
      client: CLIENT,
    });

    expect(second.accountId).toBe(first.accountId);
    expect(accounts.stored).toHaveLength(1);
    expect(terms.recorded).toHaveLength(2);
  });

  it('opens a new account for an owner whose only account has ended', async () => {
    const { requestCode, completeSignUp, mail, admins, accounts } = setup();
    const owner = await admins.findOrCreateByEmail(EMAIL);
    accounts.add(accountOf({ ownerAdminId: owner.id, status: 'ended' }));

    const signedUp = await completeSignUp.execute({
      email: EMAIL,
      code: await sentCode(requestCode, mail),
      termsVersion: TERMS,
      client: CLIENT,
    });

    expect(signedUp.accountId).not.toBe('acc00000-0000-4000-a000-000000000099');
    expect(accounts.stored.map((account) => account.status)).toEqual(['ended', 'incomplete']);
  });

  it('refuses terms older than the published version, before touching the code', async () => {
    const { requestCode, completeSignUp, mail, codes, accounts } = setup();
    const code = await sentCode(requestCode, mail);

    const attempt = completeSignUp.execute({
      email: EMAIL,
      code,
      termsVersion: '2026-01-01',
      client: CLIENT,
    });

    await expect(attempt).rejects.toEqual(new TermsOutdatedError(TERMS));
    expect(codes.stored[0]?.usedAt).toBeNull();
    expect(accounts.stored).toEqual([]);
  });

  it('refuses a wrong code and creates nobody', async () => {
    const { requestCode, completeSignUp, mail, admins, accounts } = setup();
    await sentCode(requestCode, mail);
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    await expect(
      completeSignUp.execute({ email: EMAIL, code: '000000', termsVersion: TERMS, client: CLIENT }),
    ).rejects.toBeInstanceOf(InvalidSignInCodeError);
    expect(await admins.findByEmail(EMAIL)).toBeNull();
    expect(accounts.stored).toEqual([]);
    warn.mockRestore();
  });

  it('does not take a sign-in code as a sign-up code', async () => {
    const { completeSignUp, codes } = setup();
    await codes.create({
      email: EMAIL,
      codeHash: sha256Hex('123456'),
      emailLanguage: 'en',
      purpose: 'sign_in',
      createdAt: NOW,
      expiresAt: new Date(NOW.getTime() + SIGN_IN_CODE_TTL_MS),
    });

    await expect(
      completeSignUp.execute({ email: EMAIL, code: '123456', termsVersion: TERMS, client: CLIENT }),
    ).rejects.toBeInstanceOf(InvalidSignInCodeError);
  });

  it('refuses while sign-up is closed', async () => {
    const { completeSignUp } = setup({ ...OPEN, open: false });

    await expect(
      completeSignUp.execute({ email: EMAIL, code: '123456', termsVersion: TERMS, client: CLIENT }),
    ).rejects.toBeInstanceOf(SignUpClosedError);
  });

  it('refuses while no terms version is published', async () => {
    const { completeSignUp } = setup({ ...OPEN, termsVersion: null });

    await expect(
      completeSignUp.execute({ email: EMAIL, code: '123456', termsVersion: TERMS, client: CLIENT }),
    ).rejects.toBeInstanceOf(SignUpClosedError);
  });
});

describe('StartCheckoutUseCase', () => {
  async function ownerWith(
    context: ReturnType<typeof setup>,
    overrides: Partial<Account> = {},
  ): Promise<{ readonly ownerId: string; readonly account: Account }> {
    const owner = await context.admins.findOrCreateByEmail(EMAIL);
    const account = accountOf({ ownerAdminId: owner.id, ...overrides });
    context.accounts.add(account);
    return { ownerId: owner.id, account };
  }

  it('opens a Checkout with the free trial for an account that never subscribed', async () => {
    const context = setup();
    const { ownerId, account } = await ownerWith(context);

    const redirect = await context.startCheckout.execute({
      adminUserId: ownerId,
      ownerEmail: EMAIL,
      accountId: account.id,
      interval: 'year',
      language: 'es',
    });

    expect(redirect).toEqual({ url: `https://checkout.example.com/${account.id}` });
    expect(context.gateway.checkouts).toEqual([
      {
        accountId: account.id,
        customerId: null,
        customerEmail: EMAIL,
        interval: 'year',
        language: 'es',
        trialDays: TRIAL_DAYS,
        successUrl: `${ORIGIN}/welcome?account=${account.id}`,
        cancelUrl: `${ORIGIN}/sign-up?step=plan`,
      },
    ]);
  });

  it('opens a Checkout without a trial for a customer coming back after the end', async () => {
    const context = setup();
    const { ownerId, account } = await ownerWith(context, {
      status: 'ended',
      stripeCustomerId: 'cus_back',
    });

    await context.startCheckout.execute({
      adminUserId: ownerId,
      ownerEmail: EMAIL,
      accountId: account.id,
      interval: 'month',
      language: 'en',
    });

    expect(context.gateway.checkouts[0]).toEqual(
      expect.objectContaining({ customerId: 'cus_back', trialDays: null }),
    );
  });

  it('refuses an account that already has a running subscription', async () => {
    const context = setup();
    const { ownerId, account } = await ownerWith(context, { status: 'trialing' });

    await expect(
      context.startCheckout.execute({
        adminUserId: ownerId,
        ownerEmail: EMAIL,
        accountId: account.id,
        interval: 'month',
        language: 'en',
      }),
    ).rejects.toBeInstanceOf(SubscriptionExistsError);
    expect(context.gateway.checkouts).toEqual([]);
  });

  it('answers not found to someone who does not own the account, and for no account', async () => {
    const context = setup();
    const { account } = await ownerWith(context);
    const stranger = await context.admins.findOrCreateByEmail('stranger@example.com');

    for (const accountId of [account.id, MISSING_ID]) {
      await expect(
        context.startCheckout.execute({
          adminUserId: stranger.id,
          ownerEmail: stranger.email,
          accountId,
          interval: 'month',
          language: 'en',
        }),
      ).rejects.toBeInstanceOf(AccountNotFoundError);
    }
  });

  it('refuses while sign-up is closed', async () => {
    const context = setup({ ...OPEN, open: false });
    const { ownerId, account } = await ownerWith(context);

    await expect(
      context.startCheckout.execute({
        adminUserId: ownerId,
        ownerEmail: EMAIL,
        accountId: account.id,
        interval: 'month',
        language: 'en',
      }),
    ).rejects.toBeInstanceOf(SignUpClosedError);
  });

  it('cannot send the person back anywhere without the dashboard origin', async () => {
    const context = setup({ ...OPEN, dashboardOrigin: null });
    const { ownerId, account } = await ownerWith(context);

    await expect(
      context.startCheckout.execute({
        adminUserId: ownerId,
        ownerEmail: EMAIL,
        accountId: account.id,
        interval: 'month',
        language: 'en',
      }),
    ).rejects.toBeInstanceOf(BillingUnavailableError);
  });
});

describe('OpenBillingPortalUseCase', () => {
  it("opens Stripe's portal for the owner, returning to the account page", async () => {
    const context = setup();
    const owner = await context.admins.findOrCreateByEmail(EMAIL);
    const account = accountOf({
      ownerAdminId: owner.id,
      status: 'active',
      stripeCustomerId: 'cus_1',
    });
    context.accounts.add(account);

    const redirect = await context.openPortal.execute({
      adminUserId: owner.id,
      accountId: account.id,
      language: 'pt-BR',
    });

    expect(redirect).toEqual({ url: 'https://portal.example.com/cus_1' });
    expect(context.gateway.portals).toEqual([
      { customerId: 'cus_1', returnUrl: `${ORIGIN}/account`, language: 'pt-BR' },
    ]);
  });

  it('refuses an account that has not subscribed yet', async () => {
    const context = setup();
    const owner = await context.admins.findOrCreateByEmail(EMAIL);
    const account = accountOf({ ownerAdminId: owner.id });
    context.accounts.add(account);

    await expect(
      context.openPortal.execute({ adminUserId: owner.id, accountId: account.id, language: 'en' }),
    ).rejects.toBeInstanceOf(NoBillingYetError);
  });

  it('answers not found to someone who does not own the account', async () => {
    const context = setup();
    const owner = await context.admins.findOrCreateByEmail(EMAIL);
    const account = accountOf({ ownerAdminId: owner.id, stripeCustomerId: 'cus_1' });
    context.accounts.add(account);
    const stranger = await context.admins.findOrCreateByEmail('stranger@example.com');

    await expect(
      context.openPortal.execute({
        adminUserId: stranger.id,
        accountId: account.id,
        language: 'en',
      }),
    ).rejects.toBeInstanceOf(AccountNotFoundError);
  });

  it('cannot send the person back anywhere without the dashboard origin', async () => {
    const context = setup({ ...OPEN, dashboardOrigin: null });

    await expect(
      context.openPortal.execute({ adminUserId: 'admin', accountId: MISSING_ID, language: 'en' }),
    ).rejects.toBeInstanceOf(BillingUnavailableError);
  });
});

describe('ListMyAccountsUseCase', () => {
  it('lists the accounts owned and joined, with the month measured so far', async () => {
    const context = setup();
    const owner = await context.admins.findOrCreateByEmail(EMAIL);
    const owned = accountOf({ ownerAdminId: owner.id, status: 'trialing' });
    context.accounts.add(owned);
    const other = await context.admins.findOrCreateByEmail('other@example.com');
    const joined = accountOf({
      id: 'acc00000-0000-4000-a000-000000000098',
      ownerAdminId: other.id,
      status: 'active',
    });
    context.accounts.add(joined);
    context.accounts.addMember(joined, owner.id);
    await context.usage.record(
      '2026-11',
      [{ accountId: owned.id, events: 4200, ingestionPausedUntil: null }],
      NOW,
    );

    const accounts = await context.listAccounts.execute(owner.id);

    expect(accounts).toEqual([
      {
        account: owned,
        role: 'owner',
        month: '2026-11',
        usage: { month: '2026-11', events: 4200, updatedAt: NOW },
        limits: HOSTED_PLAN_LIMITS,
      },
      {
        account: joined,
        role: 'member',
        month: '2026-11',
        usage: null,
        limits: HOSTED_PLAN_LIMITS,
      },
    ]);
  });

  it('lists nothing for an admin without accounts', async () => {
    const context = setup();

    await expect(context.listAccounts.execute('nobody')).resolves.toEqual([]);
  });
});
