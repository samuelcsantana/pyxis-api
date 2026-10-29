import { Logger } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { sha256Hex } from '../../../domain/auth/hashing';
import type { AdminUser } from '../../../domain/entities/admin-user.entity';
import { OAuthProtocolError, RemoteMcpClosedError } from '../../../domain/errors/oauth.errors';
import { CLAUDE_CLIENT_ID } from '../../../domain/oauth/oauth-clients';
import type { RemoteMcpSettings } from '../../../domain/oauth/remote-mcp-settings';
import { FixedClock } from '../../../test-utils/fixed-clock';
import { InMemoryAdminUserRepository } from '../../../test-utils/in-memory-admin-user.repository';
import { InMemoryAuthorizationRequestRepository } from '../../../test-utils/in-memory-authorization-request.repository';
import { InMemoryOAuthConnectionRepository } from '../../../test-utils/in-memory-oauth-connection.repository';
import { SequenceRandomSource } from '../../../test-utils/sequence-random-source';
import { StubClientMetadataSource } from '../../../test-utils/stub-client-metadata-source';
import { ApproveAuthorizationRequestUseCase } from '../../../usecases/oauth/approve-authorization-request.usecase';
import { BeginAuthorizationUseCase } from '../../../usecases/oauth/begin-authorization.usecase';
import { DenyAuthorizationRequestUseCase } from '../../../usecases/oauth/deny-authorization-request.usecase';
import { DescribeAuthorizationRequestUseCase } from '../../../usecases/oauth/describe-authorization-request.usecase';
import { ExchangeAuthorizationCodeUseCase } from '../../../usecases/oauth/exchange-authorization-code.usecase';
import { ListConnectionsUseCase } from '../../../usecases/oauth/list-connections.usecase';
import { RefreshConnectionTokensUseCase } from '../../../usecases/oauth/refresh-connection-tokens.usecase';
import { RevokeConnectionUseCase } from '../../../usecases/oauth/revoke-connection.usecase';
import { RevokeOAuthTokenUseCase } from '../../../usecases/oauth/revoke-oauth-token.usecase';
import { AuthorizationRequestsController } from './authorization-requests.controller';
import {
  AuthorizationServerController,
  authorizationServerMetadata,
} from './authorization-server.controller';
import { ConnectionsController } from './connections.controller';
import {
  authorizationDecisionSchema,
  authorizationRequestSchema,
  authorizationServerMetadataSchema,
  connectionsSchema,
  tokenResponseSchema,
} from './oauth.schemas';
import { remoteMcpSettingsFromEnv } from './remote-mcp-settings-from-env';

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
const PROJECT_ID = '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a01';

async function setup(settings: RemoteMcpSettings = OPEN) {
  const requests = new InMemoryAuthorizationRequestRepository();
  const connections = new InMemoryOAuthConnectionRepository();
  const admins = new InMemoryAdminUserRepository();
  const clock = new FixedClock(NOW);
  const random = new SequenceRandomSource(Array.from({ length: 251 }, (_, index) => index));
  admins.addProject({
    id: PROJECT_ID,
    name: 'Shop',
    allowedOrigins: [],
    timezone: 'UTC',
    conversionEvent: null,
    cityEnabled: false,
    createdAt: NOW,
  });
  const admin: AdminUser = await admins.grantAccess('ana@example.com', PROJECT_ID);
  const request = { admin } as FastifyRequest;
  const server = new AuthorizationServerController(
    settings,
    new BeginAuthorizationUseCase(OPEN, new StubClientMetadataSource(), requests, clock),
    new ExchangeAuthorizationCodeUseCase(OPEN, requests, connections, admins, random, clock),
    new RefreshConnectionTokensUseCase(OPEN, connections, admins, random, clock),
    new RevokeOAuthTokenUseCase(OPEN, connections, clock),
  );
  const consent = new AuthorizationRequestsController(
    new DescribeAuthorizationRequestUseCase(OPEN, requests, connections, admins, clock),
    new ApproveAuthorizationRequestUseCase(OPEN, requests, connections, random, clock),
    new DenyAuthorizationRequestUseCase(OPEN, requests, clock),
  );
  const connected = new ConnectionsController(
    settings,
    new ListConnectionsUseCase(connections, clock),
    new RevokeConnectionUseCase(connections, clock),
  );
  const startRequest = async (): Promise<string> => {
    const { url } = await server.authorize({
      response_type: 'code',
      client_id: CLAUDE_CLIENT_ID,
      redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
      code_challenge: CHALLENGE,
      code_challenge_method: 'S256',
      state: 'state',
    });
    return String(new URL(url).searchParams.get('request'));
  };
  return { server, consent, connected, connections, request, admin, startRequest };
}

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('remoteMcpSettingsFromEnv', () => {
  it('opens only when switched on with both origins set', () => {
    const env = {
      REMOTE_MCP_OPEN: 'true' as const,
      API_ORIGIN: ISSUER,
      DASHBOARD_ORIGIN: 'https://app.example.com',
    };

    expect(remoteMcpSettingsFromEnv(env)).toEqual(OPEN);
    expect(remoteMcpSettingsFromEnv({ ...env, REMOTE_MCP_OPEN: 'false' })).toEqual(CLOSED);
    expect(remoteMcpSettingsFromEnv({ ...env, API_ORIGIN: undefined })).toEqual(CLOSED);
    expect(remoteMcpSettingsFromEnv({ ...env, DASHBOARD_ORIGIN: undefined })).toEqual(CLOSED);
  });
});

describe('AuthorizationServerController', () => {
  it('describes the issuer in the documented shape, only while open', async () => {
    const { server } = await setup();
    const { server: closed } = await setup(CLOSED);

    expect(authorizationServerMetadataSchema.parse(server.metadata())).toEqual(
      authorizationServerMetadata(ISSUER),
    );
    expect(() => closed.metadata()).toThrow(RemoteMcpClosedError);
  });

  it('trades a code, then the refresh token, in the documented shape, and revokes', async () => {
    const { server, consent, request, startRequest } = await setup();
    const { redirect_to: redirectTo } = await consent.approve(request, await startRequest());
    const code = String(new URL(redirectTo).searchParams.get('code'));

    const first = await server.token({
      grant_type: 'authorization_code',
      code,
      code_verifier: VERIFIER,
      client_id: CLAUDE_CLIENT_ID,
    });
    const second = await server.token({
      grant_type: 'refresh_token',
      refresh_token: first.refresh_token,
      client_id: CLAUDE_CLIENT_ID,
    });
    await server.revoke({ token: second.access_token });

    expect(tokenResponseSchema.parse(first)).toEqual(first);
    expect(tokenResponseSchema.parse(second)).toEqual(second);
    await expect(
      server.token({
        grant_type: 'refresh_token',
        refresh_token: second.refresh_token,
        client_id: CLAUDE_CLIENT_ID,
      }),
    ).rejects.toMatchObject({ code: 'invalid_grant' });
  });

  it.each([
    [undefined, 'invalid_request'],
    ['password', 'unsupported_grant_type'],
  ])('refuses the grant type %s as %s', async (grantType, error) => {
    const { server } = await setup();

    await expect(server.token({ grant_type: grantType })).rejects.toEqual(
      expect.objectContaining({ code: error }) as OAuthProtocolError,
    );
  });

  it('answers nothing while the remote MCP is switched off', async () => {
    const { server } = await setup(CLOSED);

    await expect(server.token({ grant_type: 'password' })).rejects.toBeInstanceOf(
      RemoteMcpClosedError,
    );
  });
});

describe('AuthorizationRequestsController', () => {
  it('describes a request for the consent page and answers both decisions with an address', async () => {
    const { consent, request, startRequest } = await setup();
    const approving = await startRequest();
    const denying = await startRequest();

    const described = await consent.describe(request, approving);
    const approved = await consent.approve(request, approving);
    const denied = await consent.deny(request, denying);

    expect(authorizationRequestSchema.parse(described)).toEqual(described);
    expect(described).toMatchObject({
      client: { name: 'Claude', host: 'claude.ai' },
      redirect: { host: 'claude.ai', loopback: false },
      projects: [{ id: PROJECT_ID, name: 'Shop' }],
    });
    expect(authorizationDecisionSchema.parse(approved)).toEqual(approved);
    expect(new URL(denied.redirect_to).searchParams.get('error')).toBe('access_denied');
  });
});

describe('ConnectionsController', () => {
  it('lists the connections with the connector address while open', async () => {
    const { connected, connections, admin, request } = await setup();
    await connections.create(
      { adminUserId: admin.id, clientId: CLAUDE_CLIENT_ID, createdAt: NOW },
      [{ kind: 'access', tokenHash: sha256Hex('a'), expiresAt: NOW }],
    );
    await connections.create(
      { adminUserId: admin.id, clientId: 'https://retired.example.com/client', createdAt: NOW },
      [],
    );

    const listed = await connected.list(request);

    expect(connectionsSchema.parse(listed)).toEqual(listed);
    expect(listed.connector).toEqual({ open: true, url: `${ISSUER}/mcp` });
    expect(listed.connections.map((connection) => connection.client)).toEqual([
      { name: 'retired.example.com', host: 'retired.example.com' },
      { name: 'Claude', host: 'claude.ai' },
    ]);
  });

  it('says the connector is closed, and revokes a connection', async () => {
    const { connected, connections, admin, request } = await setup(CLOSED);
    const connection = await connections.create(
      { adminUserId: admin.id, clientId: CLAUDE_CLIENT_ID, createdAt: NOW },
      [],
    );

    expect((await connected.list(request)).connector).toEqual({ open: false, url: null });
    await connected.revoke(request, connection.id);
    expect((await connected.list(request)).connections).toEqual([]);
  });
});
