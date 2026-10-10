import type { FastifyRequest } from 'fastify';
import type { AdminUser } from '../../../domain/entities/admin-user.entity';
import type { Project } from '../../../domain/entities/project.entity';
import type { DescribeAdminUseCase } from '../../../usecases/auth/describe-admin.usecase';
import type { RequestSignInCodeUseCase } from '../../../usecases/auth/request-sign-in-code.usecase';
import type { SignOutEverywhereUseCase } from '../../../usecases/auth/sign-out-everywhere.usecase';
import type { SignOutUseCase } from '../../../usecases/auth/sign-out.usecase';
import type { VerifySignInCodeUseCase } from '../../../usecases/auth/verify-sign-in-code.usecase';
import { AuthController, MeController } from './auth.controller';
import { SESSION_COOKIE_NAME } from './session-cookie';

const EMAIL = 'ana@example.com';
const ADMIN: AdminUser = {
  id: '00000000-0000-4000-a000-000000000001',
  email: EMAIL,
  emailLanguage: 'en',
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
};
const PROJECT: Project = {
  id: '00000000-0000-4000-b000-000000000001',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'America/Sao_Paulo',
  conversionEvent: null,
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
};

function authController() {
  const calls: { readonly useCase: string; readonly args: readonly unknown[] }[] = [];
  const record =
    <Result>(useCase: string, result: Result) =>
    (...args: unknown[]) => {
      calls.push({ useCase, args });
      return Promise.resolve(result);
    };
  const controller = new AuthController(
    { execute: record('request', undefined) } as unknown as RequestSignInCodeUseCase,
    {
      execute: record('verify', { email: EMAIL, sessionToken: 'fresh-token' }),
    } as unknown as VerifySignInCodeUseCase,
    { execute: record('signOut', undefined) } as unknown as SignOutUseCase,
    { execute: record('signOutEverywhere', 2) } as unknown as SignOutEverywhereUseCase,
  );
  return { controller, calls };
}

describe('AuthController', () => {
  it('asks for a code for the email it was given', async () => {
    const { controller, calls } = authController();

    await controller.requestCode({ email: EMAIL });

    expect(calls).toEqual([{ useCase: 'request', args: [EMAIL, undefined] }]);
  });

  it('passes on the language the dashboard asks the email to be written in', async () => {
    const { controller, calls } = authController();

    await controller.requestCode({ email: EMAIL, locale: 'pt-BR' });

    expect(calls).toEqual([{ useCase: 'request', args: [EMAIL, 'pt-BR'] }]);
  });

  it('answers the email with the session token, for the dashboard to keep', async () => {
    const { controller, calls } = authController();

    const answer = await controller.verifyCode({ email: EMAIL, code: '123456' });

    expect(calls).toEqual([{ useCase: 'verify', args: [EMAIL, '123456'] }]);
    expect(answer).toEqual({ email: EMAIL, session_token: 'fresh-token' });
  });

  it('revokes the session of the cookie the dashboard forwards', async () => {
    const { controller, calls } = authController();
    const request = {
      headers: { cookie: `${SESSION_COOKIE_NAME}=old-token` },
    } as unknown as FastifyRequest;

    await controller.logout(request);

    expect(calls).toEqual([{ useCase: 'signOut', args: ['old-token'] }]);
  });

  it('signs the admin of the session out of every device', async () => {
    const { controller, calls } = authController();
    const request = { admin: ADMIN } as unknown as FastifyRequest;

    await controller.logoutAll(request);

    expect(calls).toEqual([{ useCase: 'signOutEverywhere', args: [ADMIN] }]);
  });
});

describe('MeController', () => {
  it('describes the signed-in admin and their projects in snake case', async () => {
    const quiet = { ...PROJECT, id: 'quiet-project', firstEventAt: null, lastEventAt: null };
    const active = {
      ...PROJECT,
      firstEventAt: new Date('2026-10-01T12:00:00.000Z'),
      lastEventAt: new Date('2026-10-05T09:30:00.000Z'),
    };
    const describeAdmin = {
      execute: (admin: AdminUser) =>
        Promise.resolve({ email: admin.email, projects: [active, quiet] }),
    } as unknown as DescribeAdminUseCase;
    const request = { admin: ADMIN } as unknown as FastifyRequest;

    const body = await new MeController(describeAdmin).me(request);

    expect(body).toEqual({
      email: EMAIL,
      projects: [
        {
          id: PROJECT.id,
          name: 'Shop',
          timezone: 'America/Sao_Paulo',
          conversion_event: null,
          first_event_at: '2026-10-01T12:00:00.000Z',
          last_event_at: '2026-10-05T09:30:00.000Z',
        },
        {
          id: 'quiet-project',
          name: 'Shop',
          timezone: 'America/Sao_Paulo',
          conversion_event: null,
          first_event_at: null,
          last_event_at: null,
        },
      ],
    });
  });
});
