import { Logger } from '@nestjs/common';
import { sha256Hex } from '../../domain/auth/hashing';
import type { AdminUser } from '../../domain/entities/admin-user.entity';
import {
  AuthorizationRequestNotFoundError,
  RemoteMcpClosedError,
  TooManyConnectionsError,
  UnknownOAuthClientError,
  UnregisteredRedirectError,
} from '../../domain/errors/oauth.errors';
import { CLAUDE_CLIENT_ID, CLAUDE_CODE_CLIENT_ID } from '../../domain/oauth/oauth-clients';
import { AUTHORIZATION_CODE_PATTERN, MAX_LIVE_CONNECTIONS } from '../../domain/oauth/oauth-policy';
import type { RemoteMcpSettings } from '../../domain/oauth/remote-mcp-settings';
import { FixedClock } from '../../test-utils/fixed-clock';
import { InMemoryAdminUserRepository } from '../../test-utils/in-memory-admin-user.repository';
import { InMemoryAuthorizationRequestRepository } from '../../test-utils/in-memory-authorization-request.repository';
import { InMemoryOAuthConnectionRepository } from '../../test-utils/in-memory-oauth-connection.repository';
import { SequenceRandomSource } from '../../test-utils/sequence-random-source';
import { StubClientMetadataSource } from '../../test-utils/stub-client-metadata-source';
import { ApproveAuthorizationRequestUseCase } from './approve-authorization-request.usecase';
import { type AuthorizationQuery, BeginAuthorizationUseCase } from './begin-authorization.usecase';
import { DenyAuthorizationRequestUseCase } from './deny-authorization-request.usecase';
import { DescribeAuthorizationRequestUseCase } from './describe-authorization-request.usecase';

const NOW = new Date('2026-10-15T12:00:00.000Z');
const ISSUER = 'https://api.example.com';
const DASHBOARD = 'https://app.example.com';
const OPEN: RemoteMcpSettings = { open: true, issuer: ISSUER, dashboardOrigin: DASHBOARD };
const CLOSED: RemoteMcpSettings = { open: false };
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const CLAUDE_REDIRECT = 'https://claude.ai/api/mcp/auth_callback';
const LOOPBACK_REDIRECT = 'http://127.0.0.1:53682/callback';
const MINUTE_MS = 60_000;

const VALID_QUERY: AuthorizationQuery = {
  responseType: 'code',
  clientId: CLAUDE_CLIENT_ID,
  redirectUri: CLAUDE_REDIRECT,
  codeChallenge: CHALLENGE,
  codeChallengeMethod: 'S256',
  state: 'state-from-claude',
  resource: `${ISSUER}/mcp`,
};

function parametersOf(location: string): Record<string, string> {
  return Object.fromEntries(new URL(location).searchParams);
}

async function setup(settings: RemoteMcpSettings = OPEN) {
  const requests = new InMemoryAuthorizationRequestRepository();
  const connections = new InMemoryOAuthConnectionRepository();
  const admins = new InMemoryAdminUserRepository();
  const clock = new FixedClock(NOW);
  const random = new SequenceRandomSource(Array.from({ length: 251 }, (_, index) => index));
  admins.addProject({
    id: 'project-1',
    name: 'Shop',
    allowedOrigins: ['https://shop.example.com'],
    timezone: 'UTC',
    conversionEvent: null,
    createdAt: NOW,
  });
  const ana = await admins.grantAccess('ana@example.com', 'project-1');
  const begin = new BeginAuthorizationUseCase(
    settings,
    new StubClientMetadataSource(),
    requests,
    clock,
  );
  const startRequest = async (query: Partial<AuthorizationQuery> = {}): Promise<string> => {
    const location = await begin.execute({ ...VALID_QUERY, ...query });
    return String(new URL(location).searchParams.get('request'));
  };
  return {
    requests,
    connections,
    admins,
    clock,
    ana,
    begin,
    startRequest,
    describe: new DescribeAuthorizationRequestUseCase(
      settings,
      requests,
      connections,
      admins,
      clock,
    ),
    approve: new ApproveAuthorizationRequestUseCase(settings, requests, connections, random, clock),
    deny: new DenyAuthorizationRequestUseCase(settings, requests, clock),
  };
}

async function fillConnections(
  connections: InMemoryOAuthConnectionRepository,
  admin: AdminUser,
): Promise<void> {
  for (let index = 0; index < MAX_LIVE_CONNECTIONS; index += 1) {
    await connections.create(
      { adminUserId: admin.id, clientId: CLAUDE_CLIENT_ID, createdAt: NOW },
      [],
    );
  }
}

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('BeginAuthorizationUseCase', () => {
  it('keeps a valid request for ten minutes and sends the browser to the consent page', async () => {
    const { begin, requests } = await setup();

    const location = await begin.execute(VALID_QUERY);

    const [stored] = requests.stored;
    expect(location).toBe(`${DASHBOARD}/connect?request=${String(stored?.request.id)}`);
    expect(stored?.request).toEqual({
      id: expect.any(String) as string,
      clientId: CLAUDE_CLIENT_ID,
      redirectUri: CLAUDE_REDIRECT,
      state: 'state-from-claude',
      codeChallenge: CHALLENGE,
      createdAt: NOW,
      expiresAt: new Date(NOW.getTime() + 10 * MINUTE_MS),
    });
  });

  it('takes Claude Code back to any loopback port, with no state and no resource named', async () => {
    const { begin, requests } = await setup();

    await begin.execute({
      ...VALID_QUERY,
      clientId: CLAUDE_CODE_CLIENT_ID,
      redirectUri: LOOPBACK_REDIRECT,
      state: undefined,
      resource: undefined,
    });

    expect(requests.stored[0]?.request).toMatchObject({
      clientId: CLAUDE_CODE_CLIENT_ID,
      redirectUri: LOOPBACK_REDIRECT,
      state: null,
    });
  });

  it.each([
    ['an unknown client', 'https://evil.example.com/client.json'],
    ['no client', undefined],
  ])('refuses %s without sending the browser anywhere', async (_case, clientId) => {
    const { begin, requests } = await setup();

    await expect(begin.execute({ ...VALID_QUERY, clientId })).rejects.toBeInstanceOf(
      UnknownOAuthClientError,
    );
    expect(requests.stored).toHaveLength(0);
  });

  it.each([
    ['an address the client never registered', 'https://evil.example.com/callback'],
    ['an overlong address', `${CLAUDE_REDIRECT}?${'a'.repeat(600)}`],
    ['no address', undefined],
  ])('refuses %s to return to, without redirecting', async (_case, redirectUri) => {
    const { begin } = await setup();

    await expect(begin.execute({ ...VALID_QUERY, redirectUri })).rejects.toBeInstanceOf(
      UnregisteredRedirectError,
    );
  });

  it.each<[string, Partial<AuthorizationQuery>, string]>([
    ['another response type', { responseType: 'token' }, 'unsupported_response_type'],
    ['the plain PKCE method', { codeChallengeMethod: 'plain' }, 'invalid_request'],
    ['no PKCE method', { codeChallengeMethod: undefined }, 'invalid_request'],
    ['no code challenge', { codeChallenge: undefined }, 'invalid_request'],
    ['a malformed code challenge', { codeChallenge: 'short' }, 'invalid_request'],
    ['an overlong state', { state: 'x'.repeat(513) }, 'invalid_request'],
    ['another resource', { resource: 'https://api.example.com/other' }, 'invalid_target'],
  ])(
    'sends the client back with an error for %s, and stores nothing',
    async (_case, change, error) => {
      const { begin, requests } = await setup();
      const query = { ...VALID_QUERY, ...change };

      const location = await begin.execute(query);

      expect(location.startsWith(`${CLAUDE_REDIRECT}?`)).toBe(true);
      expect(parametersOf(location)).toMatchObject({ error, state: query.state, iss: ISSUER });
      expect(parametersOf(location).error_description).toEqual(expect.any(String));
      expect(requests.stored).toHaveLength(0);
    },
  );

  it('leaves the state out of an error when the client sent none', async () => {
    const { begin } = await setup();

    const location = await begin.execute({
      ...VALID_QUERY,
      responseType: 'token',
      state: undefined,
    });

    expect(parametersOf(location)).not.toHaveProperty('state');
  });

  it('logs the request and the client, never the challenge or the state', async () => {
    const logs: unknown[] = [];
    jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      logs.push(message);
    });
    const { begin } = await setup();

    await begin.execute(VALID_QUERY);

    expect(logs).toEqual([
      {
        message: 'oauth.authorization_started',
        requestId: expect.any(String) as string,
        clientId: CLAUDE_CLIENT_ID,
      },
    ]);
  });

  it('answers as an unknown address while the remote MCP is switched off', async () => {
    const { begin } = await setup(CLOSED);

    await expect(begin.execute(VALID_QUERY)).rejects.toBeInstanceOf(RemoteMcpClosedError);
  });
});

describe('DescribeAuthorizationRequestUseCase', () => {
  it('names the client by the host of its document and lists what the admin would share', async () => {
    const { describe: describeRequest, startRequest, ana } = await setup();
    const requestId = await startRequest();

    const described = await describeRequest.execute(ana, requestId);

    expect(described).toEqual({
      id: requestId,
      client: expect.objectContaining({ id: CLAUDE_CLIENT_ID, name: 'Claude' }) as unknown,
      clientHost: 'claude.ai',
      redirectHost: 'claude.ai',
      loopback: false,
      expiresAt: new Date(NOW.getTime() + 10 * MINUTE_MS),
      projects: [{ id: 'project-1', name: 'Shop' }],
      connectionLimitReached: false,
    });
  });

  it('warns when the code would go to a program on the computer', async () => {
    const { describe: describeRequest, startRequest, ana } = await setup();
    const requestId = await startRequest({
      clientId: CLAUDE_CODE_CLIENT_ID,
      redirectUri: LOOPBACK_REDIRECT,
    });

    const described = await describeRequest.execute(ana, requestId);

    expect(described).toMatchObject({ redirectHost: '127.0.0.1', loopback: true });
    expect(described.client.name).toBe('Claude Code');
  });

  it('says when the admin already keeps the most connections allowed', async () => {
    const { describe: describeRequest, startRequest, ana, connections } = await setup();
    const requestId = await startRequest();
    await fillConnections(connections, ana);

    expect((await describeRequest.execute(ana, requestId)).connectionLimitReached).toBe(true);
  });

  it('knows no request that is unknown, expired, answered or from a client no longer allowed', async () => {
    const { describe: describeRequest, startRequest, ana, clock, deny, requests } = await setup();
    const expiring = await startRequest();
    const answered = await startRequest();
    await deny.execute(ana, answered);
    const retired = await requests.create({
      clientId: 'https://retired.example.com/client.json',
      redirectUri: CLAUDE_REDIRECT,
      state: null,
      codeChallenge: CHALLENGE,
      createdAt: NOW,
      expiresAt: new Date(NOW.getTime() + 10 * MINUTE_MS),
    });

    await expect(describeRequest.execute(ana, retired.id)).rejects.toBeInstanceOf(
      AuthorizationRequestNotFoundError,
    );
    await expect(describeRequest.execute(ana, answered)).rejects.toBeInstanceOf(
      AuthorizationRequestNotFoundError,
    );
    await expect(
      describeRequest.execute(ana, '00000000-0000-4000-8000-000000000000'),
    ).rejects.toBeInstanceOf(AuthorizationRequestNotFoundError);
    clock.advanceBy(10 * MINUTE_MS);
    await expect(describeRequest.execute(ana, expiring)).rejects.toBeInstanceOf(
      AuthorizationRequestNotFoundError,
    );
  });

  it('answers as an unknown address while the remote MCP is switched off', async () => {
    const { describe: describeRequest, ana } = await setup(CLOSED);

    await expect(describeRequest.execute(ana, 'any')).rejects.toBeInstanceOf(RemoteMcpClosedError);
  });
});

describe('ApproveAuthorizationRequestUseCase', () => {
  it('issues a single-use code for five minutes and returns the browser with it', async () => {
    const { approve, startRequest, ana, requests } = await setup();
    const requestId = await startRequest();

    const location = await approve.execute(ana, requestId);

    const parameters = parametersOf(location);
    expect(location.startsWith(`${CLAUDE_REDIRECT}?`)).toBe(true);
    expect(parameters).toEqual({
      code: expect.stringMatching(AUTHORIZATION_CODE_PATTERN) as string,
      state: 'state-from-claude',
      iss: ISSUER,
    });
    expect(requests.stored[0]).toMatchObject({
      decision: 'approved',
      approval: {
        adminUserId: ana.id,
        codeHash: sha256Hex(String(parameters.code)),
        codeExpiresAt: new Date(NOW.getTime() + 5 * MINUTE_MS),
        decidedAt: NOW,
      },
    });
    expect(JSON.stringify(requests.stored)).not.toContain(String(parameters.code));
  });

  it('leaves the state out when the client sent none', async () => {
    const { approve, startRequest, ana } = await setup();
    const requestId = await startRequest({ state: undefined });

    expect(parametersOf(await approve.execute(ana, requestId))).not.toHaveProperty('state');
  });

  it('answers a request once, and never an unknown or expired one', async () => {
    const { approve, startRequest, ana, clock } = await setup();
    const requestId = await startRequest();
    const expiring = await startRequest();
    await approve.execute(ana, requestId);

    await expect(approve.execute(ana, requestId)).rejects.toBeInstanceOf(
      AuthorizationRequestNotFoundError,
    );
    clock.advanceBy(10 * MINUTE_MS);
    await expect(approve.execute(ana, expiring)).rejects.toBeInstanceOf(
      AuthorizationRequestNotFoundError,
    );
  });

  it('refuses one connection more than an admin keeps', async () => {
    const { approve, startRequest, ana, connections } = await setup();
    const requestId = await startRequest();
    await fillConnections(connections, ana);

    await expect(approve.execute(ana, requestId)).rejects.toBeInstanceOf(TooManyConnectionsError);
  });

  it('loses gracefully to an answer given in between', async () => {
    const { approve, startRequest, ana, requests } = await setup();
    const requestId = await startRequest();
    jest.spyOn(requests, 'approve').mockResolvedValue(null);

    await expect(approve.execute(ana, requestId)).rejects.toBeInstanceOf(
      AuthorizationRequestNotFoundError,
    );
  });

  it('answers as an unknown address while the remote MCP is switched off', async () => {
    const { approve, ana } = await setup(CLOSED);

    await expect(approve.execute(ana, 'any')).rejects.toBeInstanceOf(RemoteMcpClosedError);
  });
});

describe('DenyAuthorizationRequestUseCase', () => {
  it('returns the browser with access_denied and the state, and closes the request', async () => {
    const { deny, startRequest, ana, requests } = await setup();
    const requestId = await startRequest();

    const location = await deny.execute(ana, requestId);

    expect(parametersOf(location)).toEqual({
      error: 'access_denied',
      error_description: 'The person declined the connection.',
      state: 'state-from-claude',
      iss: ISSUER,
    });
    expect(requests.stored[0]?.decision).toBe('denied');
    await expect(deny.execute(ana, requestId)).rejects.toBeInstanceOf(
      AuthorizationRequestNotFoundError,
    );
  });

  it('answers as an unknown address while the remote MCP is switched off', async () => {
    const { deny, ana } = await setup(CLOSED);

    await expect(deny.execute(ana, 'any')).rejects.toBeInstanceOf(RemoteMcpClosedError);
  });
});
