import type { FastifyRequest } from 'fastify';
import { FixedClock } from '../../../test-utils/fixed-clock';
import type { SignUpSettings } from '../../../domain/accounts/sign-up-settings';
import type {
  CompleteSignUpCommand,
  CompleteSignUpUseCase,
} from '../../../usecases/accounts/complete-sign-up.usecase';
import { ReadSignUpStatusUseCase } from '../../../usecases/accounts/read-sign-up-status.usecase';
import type { RequestSignUpCodeUseCase } from '../../../usecases/accounts/request-sign-up-code.usecase';
import { InMemoryAccountRepository } from '../../../test-utils/in-memory-account.repository';
import { InMemoryAdminUserRepository } from '../../../test-utils/in-memory-admin-user.repository';
import { SignUpController } from './sign-up.controller';

const EMAIL = 'founder@example.com';
const ACCOUNT_ID = 'acc00000-0000-4000-a000-000000000001';

function signUpController(settings: SignUpSettings) {
  const codeRequests: (readonly [string, string | undefined])[] = [];
  const completions: CompleteSignUpCommand[] = [];
  const controller = new SignUpController(
    {
      execute: (email: string, locale?: string) => {
        codeRequests.push([email, locale]);
        return Promise.resolve();
      },
    } as unknown as RequestSignUpCodeUseCase,
    {
      execute: (command: CompleteSignUpCommand) => {
        completions.push(command);
        return Promise.resolve({
          email: EMAIL,
          sessionToken: 'fresh-token',
          accountId: ACCOUNT_ID,
          accountStatus: 'free',
        });
      },
    } as unknown as CompleteSignUpUseCase,
    new ReadSignUpStatusUseCase(
      new InMemoryAccountRepository(new InMemoryAdminUserRepository()),
      settings,
      new FixedClock(new Date('2026-11-20T12:00:00.000Z')),
    ),
  );
  return { controller, codeRequests, completions };
}

const OPEN: SignUpSettings = {
  open: true,
  termsVersion: '2026-11-01',
  termsUrl: 'https://example.com/terms',
  dashboardOrigin: 'https://app.example.com',
  freePlanOpen: false,
  freeAccountsMax: 200,
  trialOffered: true,
  freePlanTermsForEarlierAccountsFrom: null,
};

describe('SignUpController', () => {
  it('tells the dashboard sign-up is open, which terms to show and whether the free plan takes new owners', async () => {
    expect(await signUpController(OPEN).controller.status()).toEqual({
      open: true,
      terms_version: '2026-11-01',
      terms_url: 'https://example.com/terms',
      free_plan: 'closed',
    });
    expect(
      (await signUpController({ ...OPEN, freePlanOpen: true }).controller.status()).free_plan,
    ).toBe('open');
  });

  it('tells the dashboard sign-up is closed, without a terms version', async () => {
    expect(await signUpController({ ...OPEN, open: false }).controller.status()).toEqual({
      open: false,
      terms_version: null,
      terms_url: null,
      free_plan: 'closed',
    });
  });

  it('asks for a sign-up code in the language given', async () => {
    const { controller, codeRequests } = signUpController(OPEN);

    await controller.code({ email: EMAIL, locale: 'es' });

    expect(codeRequests).toEqual([[EMAIL, 'es']]);
  });

  it('completes the sign-up with the terms accepted and the client that asked', async () => {
    const { controller, completions } = signUpController(OPEN);
    const request = {
      headers: { 'user-agent': 'Browser/1.0', 'sec-ch-ua-mobile': '?0' },
    } as unknown as FastifyRequest;

    const body = await controller.verify(
      { email: EMAIL, code: '123456', terms_version: '2026-11-01' },
      request,
    );

    expect(body).toEqual({
      email: EMAIL,
      session_token: 'fresh-token',
      account_id: ACCOUNT_ID,
      account_status: 'free',
    });
    expect(completions).toEqual([
      {
        email: EMAIL,
        code: '123456',
        termsVersion: '2026-11-01',
        client: {
          userAgent: 'Browser/1.0',
          clientHints: { mobile: '?0', platform: undefined },
        },
      },
    ]);
  });
});
