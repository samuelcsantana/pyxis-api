import type { ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { sha256Hex } from '../../../domain/auth/hashing';
import { UnauthenticatedError } from '../../../domain/errors/auth.errors';
import { FixedClock } from '../../../test-utils/fixed-clock';
import { InMemoryAccessTokenRepository } from '../../../test-utils/in-memory-access-token.repository';
import { InMemoryAdminSessionRepository } from '../../../test-utils/in-memory-admin-session.repository';
import { InMemoryAdminUserRepository } from '../../../test-utils/in-memory-admin-user.repository';
import { InMemoryOAuthConnectionRepository } from '../../../test-utils/in-memory-oauth-connection.repository';
import { AuthenticateAccessTokenUseCase } from '../../../usecases/auth/authenticate-access-token.usecase';
import { AuthenticateSessionUseCase } from '../../../usecases/auth/authenticate-session.usecase';
import { AuthenticateConnectionTokenUseCase } from '../../../usecases/oauth/authenticate-connection-token.usecase';
import { ReadAccessGuard } from './read-access.guard';
import { SESSION_COOKIE_NAME } from './session-cookie';

const NOW = new Date('2026-10-14T12:00:00.000Z');
const SESSION_TOKEN = 'session-token';
const ACCESS_TOKEN = `pyxis_at_${'A'.repeat(32)}`;
const CONNECTION_TOKEN = `pyxis_oat_${'B'.repeat(43)}`;
const DAY = 86_400_000;

function requestWith(headers: Record<string, string>): FastifyRequest {
  return { headers } as unknown as FastifyRequest;
}

function contextOf(request: FastifyRequest): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
}

async function setup() {
  const clock = new FixedClock(NOW);
  const admins = new InMemoryAdminUserRepository();
  const admin = await admins.grantAccess('ana@example.com', 'project-1');
  const sessions = new InMemoryAdminSessionRepository();
  const session = await sessions.create({
    adminUserId: admin.id,
    tokenHash: sha256Hex(SESSION_TOKEN),
    createdAt: NOW,
  });
  const tokens = new InMemoryAccessTokenRepository();
  const token = await tokens.create({
    adminUserId: admin.id,
    name: 'Claude Code',
    tokenHash: sha256Hex(ACCESS_TOKEN),
    createdAt: NOW,
    expiresAt: new Date(NOW.getTime() + 30 * DAY),
  });
  const connections = new InMemoryOAuthConnectionRepository();
  const connection = await connections.create(
    {
      adminUserId: admin.id,
      clientId: 'https://claude.ai/oauth/mcp-oauth-client-metadata',
      createdAt: NOW,
    },
    [
      {
        kind: 'access',
        tokenHash: sha256Hex(CONNECTION_TOKEN),
        expiresAt: new Date(NOW.getTime() + DAY),
      },
    ],
  );
  const guard = new ReadAccessGuard(
    new AuthenticateSessionUseCase(sessions, admins, clock),
    new AuthenticateAccessTokenUseCase(tokens, admins, clock),
    new AuthenticateConnectionTokenUseCase(connections, admins, clock),
  );
  return { guard, admin, session, token, tokens, connection, connections };
}

describe('ReadAccessGuard', () => {
  it('reads the dashboard session when no authorization header is sent', async () => {
    const { guard, admin, session } = await setup();
    const request = requestWith({ cookie: `${SESSION_COOKIE_NAME}=${SESSION_TOKEN}` });

    await expect(guard.canActivate(contextOf(request))).resolves.toBe(true);

    expect(request.admin).toEqual(admin);
    expect(request.session).toEqual(session);
    expect(request.accessToken).toBeUndefined();
  });

  it('refuses a request with neither a session nor a token', async () => {
    const { guard } = await setup();

    await expect(guard.canActivate(contextOf(requestWith({})))).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
  });

  it('reads an access token from a bearer header, leaving the session empty', async () => {
    const { guard, admin, token } = await setup();
    const request = requestWith({ authorization: `Bearer ${ACCESS_TOKEN}` });

    await expect(guard.canActivate(contextOf(request))).resolves.toBe(true);

    expect(request.admin).toEqual(admin);
    expect(request.accessToken).toEqual(token);
    expect(request.session).toBeUndefined();
  });

  it('reads the access token of a connected application, leaving the rest empty', async () => {
    const { guard, admin, connection } = await setup();
    const request = requestWith({ authorization: `Bearer ${CONNECTION_TOKEN}` });

    await expect(guard.canActivate(contextOf(request))).resolves.toBe(true);

    expect(request.admin).toEqual(admin);
    expect(request.oauthConnection).toEqual(connection);
    expect(request.accessToken).toBeUndefined();
    expect(request.session).toBeUndefined();
  });

  it('refuses the access token of a revoked connection and any refresh token', async () => {
    const { guard, connection, connections } = await setup();
    await connections.revoke(connection.id, NOW);

    for (const token of [CONNECTION_TOKEN, `pyxis_ort_${'B'.repeat(43)}`]) {
      await expect(
        guard.canActivate(contextOf(requestWith({ authorization: `Bearer ${token}` }))),
      ).rejects.toBeInstanceOf(UnauthenticatedError);
    }
  });

  it('prefers the bearer header over a session cookie sent with it', async () => {
    const { guard } = await setup();
    const request = requestWith({
      authorization: `Bearer pyxis_at_${'Z'.repeat(32)}`,
      cookie: `${SESSION_COOKIE_NAME}=${SESSION_TOKEN}`,
    });

    await expect(guard.canActivate(contextOf(request))).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
    expect(request.admin).toBeUndefined();
  });

  it.each([
    [`Bearer pyxis_sk_${'A'.repeat(32)}`],
    [`Basic ${ACCESS_TOKEN}`],
    ['Bearer not-a-token'],
  ])('refuses %j before looking anything up', async (authorization) => {
    const { guard } = await setup();

    await expect(
      guard.canActivate(contextOf(requestWith({ authorization }))),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it('refuses a revoked token', async () => {
    const { guard, admin, token, tokens } = await setup();
    await tokens.revokeOneOf(admin.id, token.id, NOW);

    await expect(
      guard.canActivate(contextOf(requestWith({ authorization: `Bearer ${ACCESS_TOKEN}` }))),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});
