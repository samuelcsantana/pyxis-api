import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { FastifyRequest } from 'fastify';
import type { EnvConfig } from '../../../config/env.schema';
import { sha256Hex } from '../../../domain/auth/hashing';
import { UnauthenticatedError } from '../../../domain/errors/auth.errors';
import { FixedClock } from '../../../test-utils/fixed-clock';
import { InMemoryAdminSessionRepository } from '../../../test-utils/in-memory-admin-session.repository';
import { InMemoryAdminUserRepository } from '../../../test-utils/in-memory-admin-user.repository';
import { AuthenticateSessionUseCase } from '../../../usecases/auth/authenticate-session.usecase';
import { DashboardOriginRequiredError } from '../errors/http-errors';
import { adminOf, DashboardOriginGuard, SessionGuard, sessionOf } from './auth.guards';
import { SESSION_COOKIE_NAME } from './session-cookie';

const DASHBOARD_ORIGIN = 'https://pyxis.example.com';
const SESSION_TOKEN = 'session-token';

function requestWith(headers: Record<string, string>): FastifyRequest {
  return { headers } as unknown as FastifyRequest;
}

function contextOf(request: FastifyRequest): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
}

function originGuard(dashboardOrigin: string | undefined): DashboardOriginGuard {
  const config = { get: () => dashboardOrigin } as unknown as ConfigService<EnvConfig, true>;
  return new DashboardOriginGuard(config);
}

async function sessionGuard() {
  const now = new Date('2026-10-06T14:00:00.000Z');
  const admins = new InMemoryAdminUserRepository();
  const admin = await admins.grantAccess('ana@example.com', 'project-1');
  const sessions = new InMemoryAdminSessionRepository();
  await sessions.create({
    adminUserId: admin.id,
    tokenHash: sha256Hex(SESSION_TOKEN),
    createdAt: now,
  });
  const authenticate = new AuthenticateSessionUseCase(sessions, admins, new FixedClock(now));
  return { guard: new SessionGuard(authenticate), admin };
}

describe('DashboardOriginGuard', () => {
  it('lets the dashboard origin through', () => {
    const request = requestWith({ origin: DASHBOARD_ORIGIN });

    expect(originGuard(DASHBOARD_ORIGIN).canActivate(contextOf(request))).toBe(true);
  });

  it('refuses another origin', () => {
    const request = requestWith({ origin: 'https://evil.example.com' });

    expect(() => originGuard(DASHBOARD_ORIGIN).canActivate(contextOf(request))).toThrow(
      DashboardOriginRequiredError,
    );
  });

  it('refuses a request without an origin', () => {
    expect(() => originGuard(DASHBOARD_ORIGIN).canActivate(contextOf(requestWith({})))).toThrow(
      DashboardOriginRequiredError,
    );
  });

  it('refuses everything while no dashboard origin is configured', () => {
    const request = requestWith({ origin: DASHBOARD_ORIGIN });

    expect(() => originGuard(undefined).canActivate(contextOf(request))).toThrow(
      DashboardOriginRequiredError,
    );
  });
});

describe('SessionGuard', () => {
  it('puts the signed-in admin on the request', async () => {
    const { guard, admin } = await sessionGuard();
    const request = requestWith({ cookie: `${SESSION_COOKIE_NAME}=${SESSION_TOKEN}` });

    await expect(guard.canActivate(contextOf(request))).resolves.toBe(true);
    expect(adminOf(request)).toEqual(admin);
    expect(sessionOf(request).adminUserId).toBe(admin.id);
  });

  it('fails loudly when a route reads the session without the guard', () => {
    expect(() => sessionOf(requestWith({}))).toThrow('SessionGuard must run before');
  });

  it('refuses a request without a session cookie', async () => {
    const { guard } = await sessionGuard();

    await expect(guard.canActivate(contextOf(requestWith({})))).rejects.toThrow(
      UnauthenticatedError,
    );
  });

  it('refuses an unknown session token', async () => {
    const { guard } = await sessionGuard();
    const request = requestWith({ cookie: `${SESSION_COOKIE_NAME}=forged` });

    await expect(guard.canActivate(contextOf(request))).rejects.toThrow(UnauthenticatedError);
  });
});

describe('adminOf', () => {
  it('fails loudly when a route reads the admin without the session guard', () => {
    expect(() => adminOf(requestWith({}))).toThrow('SessionGuard must run before');
  });
});
