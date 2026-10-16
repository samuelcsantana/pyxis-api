import { Logger } from '@nestjs/common';
import { sha256Hex } from '../../domain/auth/hashing';
import type { AdminUser } from '../../domain/entities/admin-user.entity';
import { UnauthenticatedError } from '../../domain/errors/auth.errors';
import {
  ConnectionNotFoundError,
  OAuthProtocolError,
  RemoteMcpClosedError,
} from '../../domain/errors/oauth.errors';
import { CLAUDE_CLIENT_ID, CLAUDE_CODE_CLIENT_ID } from '../../domain/oauth/oauth-clients';
import {
  CONNECTION_ACCESS_TOKEN_PATTERN,
  CONNECTION_REFRESH_TOKEN_PATTERN,
} from '../../domain/oauth/oauth-policy';
import type { RemoteMcpSettings } from '../../domain/oauth/remote-mcp-settings';
import { FixedClock } from '../../test-utils/fixed-clock';
import { InMemoryAdminUserRepository } from '../../test-utils/in-memory-admin-user.repository';
import { InMemoryAuthorizationRequestRepository } from '../../test-utils/in-memory-authorization-request.repository';
import { InMemoryOAuthConnectionRepository } from '../../test-utils/in-memory-oauth-connection.repository';
import { SequenceRandomSource } from '../../test-utils/sequence-random-source';
import { StubClientMetadataSource } from '../../test-utils/stub-client-metadata-source';
import { ApproveAuthorizationRequestUseCase } from './approve-authorization-request.usecase';
import { AuthenticateConnectionTokenUseCase } from './authenticate-connection-token.usecase';
import { BeginAuthorizationUseCase } from './begin-authorization.usecase';
import type { TokenGrant } from './connection-token-grant';
import {
  type CodeExchange,
  ExchangeAuthorizationCodeUseCase,
} from './exchange-authorization-code.usecase';
import { ListConnectionsUseCase } from './list-connections.usecase';
import { RefreshConnectionTokensUseCase } from './refresh-connection-tokens.usecase';
import { RevokeConnectionAsOperatorUseCase } from './revoke-connection-as-operator.usecase';
import { RevokeConnectionUseCase } from './revoke-connection.usecase';
import { RevokeOAuthTokenUseCase } from './revoke-oauth-token.usecase';

const NOW = new Date('2026-10-15T12:00:00.000Z');
const ISSUER = 'https://api.example.com';
const OPEN: RemoteMcpSettings = {
  open: true,
  issuer: ISSUER,
  dashboardOrigin: 'https://app.example.com',
};
const CLOSED: RemoteMcpSettings = { open: false };
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const CLAUDE_REDIRECT = 'https://claude.ai/api/mcp/auth_callback';
const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const DAY_MS = 86_400_000;

async function setup(settings: RemoteMcpSettings = OPEN) {
  const requests = new InMemoryAuthorizationRequestRepository();
  const connections = new InMemoryOAuthConnectionRepository();
  const admins = new InMemoryAdminUserRepository();
  const clock = new FixedClock(NOW);
  const random = new SequenceRandomSource(Array.from({ length: 251 }, (_, index) => index));
  const ana = await admins.grantAccess('ana@example.com', 'project-1');
  const bruno = await admins.grantAccess('bruno@example.com', 'project-1');
  const begin = new BeginAuthorizationUseCase(
    OPEN,
    new StubClientMetadataSource(),
    requests,
    clock,
  );
  const approve = new ApproveAuthorizationRequestUseCase(
    OPEN,
    requests,
    connections,
    random,
    clock,
  );
  const exchange = new ExchangeAuthorizationCodeUseCase(
    settings,
    requests,
    connections,
    admins,
    random,
    clock,
  );
  const codeFor = async (admin: AdminUser, clientId = CLAUDE_CLIENT_ID): Promise<string> => {
    const redirectUri =
      clientId === CLAUDE_CLIENT_ID ? CLAUDE_REDIRECT : 'http://localhost:4000/callback';
    const consent = await begin.execute({
      responseType: 'code',
      clientId,
      redirectUri,
      codeChallenge: CHALLENGE,
      codeChallengeMethod: 'S256',
      state: 'state',
    });
    const requestId = String(new URL(consent).searchParams.get('request'));
    return String(new URL(await approve.execute(admin, requestId)).searchParams.get('code'));
  };
  const connect = async (admin: AdminUser = ana): Promise<TokenGrant> =>
    exchange.execute({
      code: await codeFor(admin),
      codeVerifier: VERIFIER,
      clientId: CLAUDE_CLIENT_ID,
    });
  return {
    requests,
    connections,
    admins,
    clock,
    ana,
    bruno,
    codeFor,
    connect,
    exchange,
    refresh: new RefreshConnectionTokensUseCase(settings, connections, admins, random, clock),
    revokeToken: new RevokeOAuthTokenUseCase(settings, connections, clock),
    authenticate: new AuthenticateConnectionTokenUseCase(connections, admins, clock),
    list: new ListConnectionsUseCase(connections, clock),
    revokeConnection: new RevokeConnectionUseCase(connections, clock),
    revokeAsOperator: new RevokeConnectionAsOperatorUseCase(connections, clock),
  };
}

function oauthError(code: string): unknown {
  return expect.objectContaining({ code }) as unknown;
}

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('ExchangeAuthorizationCodeUseCase', () => {
  it('trades the code and its verifier for an hour of access and a refresh token, kept as hashes', async () => {
    const { exchange, codeFor, ana, connections, requests } = await setup();
    const code = await codeFor(ana);

    const grant = await exchange.execute({
      code,
      codeVerifier: VERIFIER,
      clientId: CLAUDE_CLIENT_ID,
      redirectUri: CLAUDE_REDIRECT,
      resource: `${ISSUER}/mcp`,
    });

    expect(grant).toEqual({
      accessToken: expect.stringMatching(CONNECTION_ACCESS_TOKEN_PATTERN) as string,
      refreshToken: expect.stringMatching(CONNECTION_REFRESH_TOKEN_PATTERN) as string,
      expiresInSeconds: 3600,
      scope: 'read',
    });
    expect(connections.connections.map((entry) => entry.connection)).toEqual([
      {
        id: expect.any(String) as string,
        adminUserId: ana.id,
        clientId: CLAUDE_CLIENT_ID,
        createdAt: NOW,
        lastUsedAt: NOW,
      },
    ]);
    expect(
      connections.tokens.map((token) => [token.kind, token.tokenHash, token.expiresAt]),
    ).toEqual([
      ['access', sha256Hex(grant.accessToken), new Date(NOW.getTime() + 60 * MINUTE_MS)],
      ['refresh', sha256Hex(grant.refreshToken), new Date(NOW.getTime() + 90 * DAY_MS)],
    ]);
    expect(requests.stored[0]?.connectionId).toBe(connections.connections[0]?.connection.id);
    expect(JSON.stringify(connections)).not.toContain(grant.accessToken);
  });

  it.each<[string, Partial<CodeExchange>, string]>([
    ['no client_id', { clientId: undefined }, 'invalid_request'],
    ['an empty client_id', { clientId: '' }, 'invalid_request'],
    ['no code', { code: undefined }, 'invalid_request'],
    ['no code_verifier', { codeVerifier: undefined }, 'invalid_request'],
    ['an unknown client', { clientId: 'https://evil.example.com/client.json' }, 'invalid_client'],
    ['another resource', { resource: 'https://api.example.com/other' }, 'invalid_target'],
  ])('refuses %s before spending the code', async (_case, change, error) => {
    const { exchange, codeFor, ana } = await setup();
    const code = await codeFor(ana);
    const valid = { code, codeVerifier: VERIFIER, clientId: CLAUDE_CLIENT_ID };

    await expect(exchange.execute({ ...valid, ...change })).rejects.toEqual(oauthError(error));
    await expect(exchange.execute(valid)).resolves.toMatchObject({ scope: 'read' });
  });

  it.each<[string, Partial<CodeExchange>]>([
    ['a wrong verifier', { codeVerifier: `${VERIFIER.slice(0, -1)}A` }],
    ['another client', { clientId: CLAUDE_CODE_CLIENT_ID }],
    ['another redirect address', { redirectUri: 'https://claude.ai/other' }],
  ])('refuses %s and burns the code for good', async (_case, change) => {
    const { exchange, codeFor, ana, connections } = await setup();
    const code = await codeFor(ana);
    const valid = { code, codeVerifier: VERIFIER, clientId: CLAUDE_CLIENT_ID };

    await expect(exchange.execute({ ...valid, ...change })).rejects.toEqual(
      oauthError('invalid_grant'),
    );
    await expect(exchange.execute(valid)).rejects.toEqual(oauthError('invalid_grant'));
    expect(connections.connections).toHaveLength(0);
  });

  it('refuses a code after its five minutes, or one never issued', async () => {
    const { exchange, codeFor, ana, clock } = await setup();
    const code = await codeFor(ana);
    clock.advanceBy(5 * MINUTE_MS);

    await expect(
      exchange.execute({ code, codeVerifier: VERIFIER, clientId: CLAUDE_CLIENT_ID }),
    ).rejects.toEqual(oauthError('invalid_grant'));
    await expect(
      exchange.execute({
        code: 'never-issued',
        codeVerifier: VERIFIER,
        clientId: CLAUDE_CLIENT_ID,
      }),
    ).rejects.toBeInstanceOf(OAuthProtocolError);
  });

  it('drops the connection a code made when the same code comes back', async () => {
    const { exchange, codeFor, ana, authenticate } = await setup();
    const warnings: unknown[] = [];
    jest.spyOn(Logger.prototype, 'warn').mockImplementation((message: unknown) => {
      warnings.push(message);
    });
    const code = await codeFor(ana);
    const grant = await exchange.execute({
      code,
      codeVerifier: VERIFIER,
      clientId: CLAUDE_CLIENT_ID,
    });

    await expect(
      exchange.execute({ code, codeVerifier: VERIFIER, clientId: CLAUDE_CLIENT_ID }),
    ).rejects.toEqual(oauthError('invalid_grant'));
    await expect(authenticate.execute(grant.accessToken)).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
    expect(warnings).toEqual([
      { message: 'oauth.code_replayed', connectionId: expect.any(String) as string },
    ]);
  });

  it('refuses the code of an admin suspended or gone since the approval', async () => {
    const { exchange, codeFor, ana, admins } = await setup();
    const suspendedCode = await codeFor(ana);
    const ghost: AdminUser = { ...ana, id: '00000000-0000-4000-a000-0000000000ff' };
    const ghostCode = await codeFor(ghost);
    await admins.suspend(ana.id, NOW);

    for (const code of [suspendedCode, ghostCode]) {
      await expect(
        exchange.execute({ code, codeVerifier: VERIFIER, clientId: CLAUDE_CLIENT_ID }),
      ).rejects.toEqual(oauthError('invalid_grant'));
    }
  });

  it('refuses a code once the admin reaches ten live connections between approval and exchange', async () => {
    const { connect, exchange, codeFor, ana, list } = await setup();
    for (let index = 0; index < 9; index += 1) {
      await connect(ana);
    }
    const tenthCode = await codeFor(ana);
    const eleventhCode = await codeFor(ana);

    await expect(
      exchange.execute({ code: tenthCode, codeVerifier: VERIFIER, clientId: CLAUDE_CLIENT_ID }),
    ).resolves.toMatchObject({ scope: 'read' });
    await expect(
      exchange.execute({ code: eleventhCode, codeVerifier: VERIFIER, clientId: CLAUDE_CLIENT_ID }),
    ).rejects.toEqual(oauthError('invalid_grant'));
    expect(await list.execute(ana)).toHaveLength(10);
  });

  it('logs the new connection with ids only', async () => {
    const logs: unknown[] = [];
    const { codeFor, exchange, ana } = await setup();
    const code = await codeFor(ana);
    jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      logs.push(message);
    });

    await exchange.execute({ code, codeVerifier: VERIFIER, clientId: CLAUDE_CLIENT_ID });

    expect(logs).toEqual([
      {
        message: 'oauth.connection_created',
        connectionId: expect.any(String) as string,
        adminUserId: ana.id,
        clientId: CLAUDE_CLIENT_ID,
      },
    ]);
  });

  it('answers as an unknown address while the remote MCP is switched off', async () => {
    const { exchange } = await setup(CLOSED);

    await expect(exchange.execute({})).rejects.toBeInstanceOf(RemoteMcpClosedError);
  });
});

describe('RefreshConnectionTokensUseCase', () => {
  it('trades a refresh token once for a new pair and records the use', async () => {
    const { connect, refresh, connections, clock, authenticate, bruno } = await setup();
    const first = await connect();
    const untouched = await connect(bruno);
    clock.advanceBy(50 * MINUTE_MS);

    const second = await refresh.execute({
      refreshToken: first.refreshToken,
      clientId: CLAUDE_CLIENT_ID,
      resource: `${ISSUER}/mcp`,
    });

    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(second.accessToken).toMatch(CONNECTION_ACCESS_TOKEN_PATTERN);
    const later = new Date(NOW.getTime() + 50 * MINUTE_MS);
    expect(connections.connections[0]?.connection.lastUsedAt).toEqual(later);
    expect(
      connections.tokens.find((token) => token.tokenHash === sha256Hex(first.refreshToken))
        ?.rotatedAt,
    ).toEqual(later);
    await expect(authenticate.execute(first.accessToken)).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
    await expect(authenticate.execute(untouched.accessToken)).resolves.toMatchObject({
      admin: { email: 'bruno@example.com' },
    });
  });

  it('answers a replay within a minute with another pair, replacing the superseded one', async () => {
    const { connect, refresh, clock, authenticate } = await setup();
    const first = await connect();
    const second = await refresh.execute({
      refreshToken: first.refreshToken,
      clientId: CLAUDE_CLIENT_ID,
    });
    clock.advanceBy(60 * SECOND_MS);

    const again = await refresh.execute({
      refreshToken: first.refreshToken,
      clientId: CLAUDE_CLIENT_ID,
    });

    await expect(authenticate.execute(second.accessToken)).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
    await expect(
      refresh.execute({ refreshToken: second.refreshToken, clientId: CLAUDE_CLIENT_ID }),
    ).rejects.toEqual(oauthError('invalid_grant'));
    await expect(authenticate.execute(again.accessToken)).resolves.toMatchObject({
      admin: { email: 'ana@example.com' },
    });
  });

  it('drops the whole connection when a rotated refresh token comes back later', async () => {
    const { connect, refresh, clock, authenticate } = await setup();
    const warnings: unknown[] = [];
    jest.spyOn(Logger.prototype, 'warn').mockImplementation((message: unknown) => {
      warnings.push(message);
    });
    const first = await connect();
    const second = await refresh.execute({
      refreshToken: first.refreshToken,
      clientId: CLAUDE_CLIENT_ID,
    });
    clock.advanceBy(61 * SECOND_MS);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await expect(
        refresh.execute({ refreshToken: first.refreshToken, clientId: CLAUDE_CLIENT_ID }),
      ).rejects.toEqual(oauthError('invalid_grant'));
    }
    await expect(
      refresh.execute({ refreshToken: second.refreshToken, clientId: CLAUDE_CLIENT_ID }),
    ).rejects.toEqual(oauthError('invalid_grant'));
    await expect(authenticate.execute(second.accessToken)).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
    expect(warnings).toEqual([
      { message: 'oauth.refresh_token_replayed', connectionId: expect.any(String) as string },
    ]);
  });

  it.each([
    ['no client_id', { clientId: undefined }, 'invalid_request'],
    ['no refresh_token', { refreshToken: undefined }, 'invalid_request'],
    ['an unknown client', { clientId: 'https://evil.example.com/client.json' }, 'invalid_client'],
    ['another resource', { resource: 'https://api.example.com/other' }, 'invalid_target'],
    ['a token never issued', { refreshToken: `pyxis_ort_${'A'.repeat(43)}` }, 'invalid_grant'],
    ['the token of another client', { clientId: CLAUDE_CODE_CLIENT_ID }, 'invalid_grant'],
  ])('refuses %s', async (_case, change, error) => {
    const { connect, refresh } = await setup();
    const { refreshToken } = await connect();

    await expect(
      refresh.execute({ refreshToken, clientId: CLAUDE_CLIENT_ID, ...change }),
    ).rejects.toEqual(oauthError(error));
  });

  it('refuses a revoked, expired or idle connection, and a suspended admin', async () => {
    const { connect, refresh, connections, clock, admins, bruno } = await setup();
    const revoked = await connect();
    await connections.revoke(String(connections.connections[0]?.connection.id), NOW);
    const idle = await connect();
    await connections.touch(String(connections.connections[1]?.connection.id), new Date(0));
    const suspended = await connect(bruno);
    await admins.suspend(bruno.id, NOW);
    const expiring = await connect();
    clock.advanceBy(90 * DAY_MS);

    for (const grant of [revoked, idle, suspended]) {
      await expect(
        refresh.execute({ refreshToken: grant.refreshToken, clientId: CLAUDE_CLIENT_ID }),
      ).rejects.toEqual(oauthError('invalid_grant'));
    }
    await expect(
      refresh.execute({ refreshToken: expiring.refreshToken, clientId: CLAUDE_CLIENT_ID }),
    ).rejects.toEqual(oauthError('invalid_grant'));
  });

  it('refuses a token whose connection outlived it', async () => {
    const { connect, refresh, connections, clock } = await setup();
    const grant = await connect();
    clock.advanceBy(90 * DAY_MS);
    await connections.touch(String(connections.connections[0]?.connection.id), clock.now());

    await expect(
      refresh.execute({ refreshToken: grant.refreshToken, clientId: CLAUDE_CLIENT_ID }),
    ).rejects.toEqual(oauthError('invalid_grant'));
  });

  it('answers as an unknown address while the remote MCP is switched off', async () => {
    const { refresh } = await setup(CLOSED);

    await expect(refresh.execute({})).rejects.toBeInstanceOf(RemoteMcpClosedError);
  });
});

describe('RevokeOAuthTokenUseCase', () => {
  it('ends the whole connection given either of its tokens', async () => {
    const { connect, revokeToken, authenticate, refresh } = await setup();
    const byAccess = await connect();
    const byRefresh = await connect();

    await revokeToken.execute({ token: byAccess.accessToken });
    await revokeToken.execute({ token: byRefresh.refreshToken });

    await expect(authenticate.execute(byAccess.accessToken)).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
    await expect(authenticate.execute(byRefresh.accessToken)).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
    await expect(
      refresh.execute({ refreshToken: byAccess.refreshToken, clientId: CLAUDE_CLIENT_ID }),
    ).rejects.toEqual(oauthError('invalid_grant'));
  });

  it('answers quietly for a token it does not know, and asks for one when missing', async () => {
    const { revokeToken } = await setup();

    await expect(revokeToken.execute({ token: 'unknown' })).resolves.toBeUndefined();
    await expect(revokeToken.execute({})).rejects.toEqual(oauthError('invalid_request'));
  });

  it('answers as an unknown address while the remote MCP is switched off', async () => {
    const { revokeToken } = await setup(CLOSED);

    await expect(revokeToken.execute({ token: 'any' })).rejects.toBeInstanceOf(
      RemoteMcpClosedError,
    );
  });
});

describe('AuthenticateConnectionTokenUseCase', () => {
  it('reads the admin of a live access token, recording use at most every five minutes', async () => {
    const { connect, authenticate, connections, clock, ana } = await setup();
    const grant = await connect();
    clock.advanceBy(4 * MINUTE_MS);

    const authenticated = await authenticate.execute(grant.accessToken);
    expect(authenticated.admin).toEqual(ana);
    expect(connections.connections[0]?.connection.lastUsedAt).toEqual(NOW);

    clock.advanceBy(MINUTE_MS);
    await authenticate.execute(grant.accessToken);
    expect(connections.connections[0]?.connection.lastUsedAt).toEqual(clock.now());
  });

  it('refuses an expired access token, an idle connection and an unknown token', async () => {
    const { connect, authenticate, connections, clock } = await setup();
    const expiring = await connect();
    const idle = await connect();
    await connections.touch(String(connections.connections[1]?.connection.id), new Date(0));

    await expect(authenticate.execute(idle.accessToken)).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
    await expect(authenticate.execute('pyxis_oat_unknown')).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
    clock.advanceBy(60 * MINUTE_MS);
    await expect(authenticate.execute(expiring.accessToken)).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
  });

  it('refuses the token of a suspended or missing admin', async () => {
    const { connect, authenticate, admins, connections, bruno } = await setup();
    const suspended = await connect(bruno);
    await admins.suspend(bruno.id, NOW);
    await connections.create({ adminUserId: 'gone', clientId: CLAUDE_CLIENT_ID, createdAt: NOW }, [
      {
        kind: 'access',
        tokenHash: sha256Hex('orphan'),
        expiresAt: new Date(NOW.getTime() + MINUTE_MS),
      },
    ]);

    await expect(authenticate.execute(suspended.accessToken)).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
    await expect(authenticate.execute('orphan')).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});

describe('connections of an admin', () => {
  it('lists the live connections, newest first, without revoked or idle ones', async () => {
    const { connect, list, connections, clock, ana, bruno } = await setup();
    await connect();
    clock.advanceBy(MINUTE_MS);
    await connect();
    await connect();
    await connect(bruno);
    const [first, second, third] = connections.connections.map((entry) => entry.connection.id);
    await connections.revoke(String(third), NOW);
    await connections.touch(String(first), new Date(0));

    expect((await list.execute(ana)).map((connection) => connection.id)).toEqual([second]);
  });

  it("revokes one of the admin's own connections, once", async () => {
    const { connect, revokeConnection, connections, ana, bruno } = await setup();
    await connect();
    const id = String(connections.connections[0]?.connection.id);

    await expect(revokeConnection.execute(bruno, id)).rejects.toBeInstanceOf(
      ConnectionNotFoundError,
    );
    await revokeConnection.execute(ana, id);
    await expect(revokeConnection.execute(ana, id)).rejects.toBeInstanceOf(ConnectionNotFoundError);
    expect(connections.connections[0]?.revokedAt).toEqual(NOW);
  });

  it('lets the operator revoke any live connection by id', async () => {
    const { connect, revokeAsOperator, connections } = await setup();
    await connect();
    const connectionId = String(connections.connections[0]?.connection.id);

    await revokeAsOperator.execute({ connectionId });

    await expect(revokeAsOperator.execute({ connectionId })).rejects.toBeInstanceOf(
      ConnectionNotFoundError,
    );
  });
});
