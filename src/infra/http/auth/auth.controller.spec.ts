import type { ConfigService } from '@nestjs/config';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { EnvConfig } from '../../../config/env.schema';
import type { AdminUser } from '../../../domain/entities/admin-user.entity';
import type { Project } from '../../../domain/entities/project.entity';
import type { DescribeAdminUseCase } from '../../../usecases/auth/describe-admin.usecase';
import type { RequestSignInCodeUseCase } from '../../../usecases/auth/request-sign-in-code.usecase';
import type { SignOutUseCase } from '../../../usecases/auth/sign-out.usecase';
import type { VerifySignInCodeUseCase } from '../../../usecases/auth/verify-sign-in-code.usecase';
import { AuthController, MeController } from './auth.controller';
import { SESSION_COOKIE_NAME } from './session-cookie';

const EMAIL = 'ana@example.com';
const COOKIE_DOMAIN = 'pyxis.example.com';
const ADMIN: AdminUser = {
  id: '00000000-0000-4000-a000-000000000001',
  email: EMAIL,
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

function replySpy() {
  const headers: Record<string, string> = {};
  const reply = {
    header(name: string, value: string) {
      headers[name] = value;
      return reply;
    },
  };
  return { reply: reply as unknown as FastifyReply, headers };
}

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
    { get: () => COOKIE_DOMAIN } as unknown as ConfigService<EnvConfig, true>,
  );
  return { controller, calls };
}

describe('AuthController', () => {
  it('asks for a code for the email it was given', async () => {
    const { controller, calls } = authController();

    await controller.requestCode({ email: EMAIL });

    expect(calls).toEqual([{ useCase: 'request', args: [EMAIL] }]);
  });

  it('sets the session cookie and answers only the email', async () => {
    const { controller, calls } = authController();
    const { reply, headers } = replySpy();

    const answer = await controller.verifyCode({ email: EMAIL, code: '123456' }, reply);

    expect(calls).toEqual([{ useCase: 'verify', args: [EMAIL, '123456'] }]);
    expect(answer).toEqual({ email: EMAIL });
    expect(headers['set-cookie']).toBe(
      `${SESSION_COOKIE_NAME}=fresh-token; HttpOnly; Secure; SameSite=Lax; Path=/; ` +
        `Max-Age=604800; Domain=${COOKIE_DOMAIN}`,
    );
  });

  it('revokes the session of the cookie and clears the cookie', async () => {
    const { controller, calls } = authController();
    const { reply, headers } = replySpy();
    const request = {
      headers: { cookie: `${SESSION_COOKIE_NAME}=old-token` },
    } as unknown as FastifyRequest;

    await controller.logout(request, reply);

    expect(calls).toEqual([{ useCase: 'signOut', args: ['old-token'] }]);
    expect(headers['set-cookie']).toContain(`${SESSION_COOKIE_NAME}=; `);
    expect(headers['set-cookie']).toContain('Max-Age=0');
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
