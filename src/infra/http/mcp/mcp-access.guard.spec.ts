import type { ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { sha256Hex } from '../../../domain/auth/hashing';
import { RemoteMcpClosedError } from '../../../domain/errors/oauth.errors';
import type { RemoteMcpSettings } from '../../../domain/oauth/remote-mcp-settings';
import { FixedClock } from '../../../test-utils/fixed-clock';
import { InMemoryAccessTokenRepository } from '../../../test-utils/in-memory-access-token.repository';
import { InMemoryAdminUserRepository } from '../../../test-utils/in-memory-admin-user.repository';
import { InMemoryOAuthConnectionRepository } from '../../../test-utils/in-memory-oauth-connection.repository';
import { AuthenticateAccessTokenUseCase } from '../../../usecases/auth/authenticate-access-token.usecase';
import { AuthenticateConnectionTokenUseCase } from '../../../usecases/oauth/authenticate-connection-token.usecase';
import { SESSION_COOKIE_NAME } from '../auth/session-cookie';
import { McpAccessGuard } from './mcp-access.guard';
import { mcpChallenge, McpUnauthorizedError } from './mcp-unauthorized';

const NOW = new Date('2026-10-15T12:00:00.000Z');
const ISSUER = 'https://api.example.com';
const OPEN: RemoteMcpSettings = {
  open: true,
  issuer: ISSUER,
  dashboardOrigin: 'https://app.example.com',
};
const ACCESS_TOKEN = `pyxis_at_${'A'.repeat(32)}`;
const CONNECTION_TOKEN = `pyxis_oat_${'B'.repeat(43)}`;
const DAY = 86_400_000;

function requestWith(headers: Record<string, string>): FastifyRequest {
  return { headers } as unknown as FastifyRequest;
}

function contextOf(request: FastifyRequest): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
}

async function refusalOf(guard: McpAccessGuard, request: FastifyRequest): Promise<unknown> {
  return guard.canActivate(contextOf(request)).then(
    () => undefined,
    (error: unknown) => error,
  );
}

async function setup(settings: RemoteMcpSettings = OPEN) {
  const clock = new FixedClock(NOW);
  const admins = new InMemoryAdminUserRepository();
  const admin = await admins.grantAccess('ana@example.com', 'project-1');
  const tokens = new InMemoryAccessTokenRepository();
  const token = await tokens.create({
    adminUserId: admin.id,
    name: 'Cursor',
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
  const authenticateAccessToken = new AuthenticateAccessTokenUseCase(tokens, admins, clock);
  const authenticateConnectionToken = new AuthenticateConnectionTokenUseCase(
    connections,
    admins,
    clock,
  );
  const guard = new McpAccessGuard(settings, authenticateAccessToken, authenticateConnectionToken);
  return { guard, admin, token, tokens, connection, connections, authenticateAccessToken };
}

describe('McpAccessGuard', () => {
  it('lets a personal access token in and records who is calling', async () => {
    const { guard } = await setup();
    const request = requestWith({ authorization: `Bearer ${ACCESS_TOKEN}` });

    await expect(guard.canActivate(contextOf(request))).resolves.toBe(true);

    expect(request.mcpCaller).toEqual({
      bearer: { kind: 'access_token', secret: ACCESS_TOKEN },
      issuer: ISSUER,
    });
  });

  it('lets the access token of a connection in', async () => {
    const { guard } = await setup();
    const request = requestWith({ authorization: `Bearer ${CONNECTION_TOKEN}` });

    await expect(guard.canActivate(contextOf(request))).resolves.toBe(true);

    expect(request.mcpCaller).toEqual({
      bearer: { kind: 'connection', secret: CONNECTION_TOKEN },
      issuer: ISSUER,
    });
  });

  it('answers 404 before anything else while the remote MCP is switched off', async () => {
    const { guard } = await setup({ open: false });

    await expect(refusalOf(guard, requestWith({}))).resolves.toBeInstanceOf(RemoteMcpClosedError);
  });

  it('asks a caller without a token to connect, never reading the session cookie', async () => {
    const { guard } = await setup();
    const request = requestWith({ cookie: `${SESSION_COOKIE_NAME}=session-token` });

    const refusal = await refusalOf(guard, request);

    expect(refusal).toBeInstanceOf(McpUnauthorizedError);
    expect((refusal as McpUnauthorizedError).challenge).toBe(mcpChallenge(ISSUER, false));
    expect(request.mcpCaller).toBeUndefined();
  });

  it.each([
    ['another scheme', `Basic ${ACCESS_TOKEN}`],
    ['a refresh token', `Bearer pyxis_ort_${'D'.repeat(43)}`],
  ])('refuses %s as an invalid token', async (_, authorization) => {
    const { guard } = await setup();

    const refusal = await refusalOf(guard, requestWith({ authorization }));

    expect((refusal as McpUnauthorizedError).challenge).toBe(mcpChallenge(ISSUER, true));
  });

  it('refuses a revoked personal access token as an invalid token', async () => {
    const { guard, admin, tokens } = await setup();
    await tokens.revokeAllOf(admin.id, NOW);

    const refusal = await refusalOf(
      guard,
      requestWith({ authorization: `Bearer ${ACCESS_TOKEN}` }),
    );

    expect((refusal as McpUnauthorizedError).challenge).toBe(mcpChallenge(ISSUER, true));
  });

  it('refuses the access token of a revoked connection as an invalid token', async () => {
    const { guard, connection, connections } = await setup();
    await connections.revoke(connection.id, NOW);

    const refusal = await refusalOf(
      guard,
      requestWith({ authorization: `Bearer ${CONNECTION_TOKEN}` }),
    );

    expect((refusal as McpUnauthorizedError).challenge).toBe(mcpChallenge(ISSUER, true));
  });

  it('lets a failure that is not a refusal through untouched', async () => {
    const { guard, authenticateAccessToken } = await setup();
    const outage = new Error('database unreachable');
    jest.spyOn(authenticateAccessToken, 'execute').mockRejectedValue(outage);

    await expect(
      refusalOf(guard, requestWith({ authorization: `Bearer ${ACCESS_TOKEN}` })),
    ).resolves.toBe(outage);
  });
});
