import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import postgres from 'postgres';
import { sha256Hex } from '../../src/domain/auth/hashing';
import { CLAUDE_CLIENT_ID, CLAUDE_CODE_CLIENT_ID } from '../../src/domain/oauth/oauth-clients';
import { REMOTE_MCP_SETTINGS } from '../../src/domain/oauth/remote-mcp-settings';
import { CLIENT_METADATA_SOURCE } from '../../src/domain/services/client-metadata-source';
import { CLOCK } from '../../src/domain/services/clock';
import { SESSION_COOKIE_NAME } from '../../src/infra/http/auth/session-cookie';
import { FixedClock } from '../../src/test-utils/fixed-clock';
import { StubClientMetadataSource } from '../../src/test-utils/stub-client-metadata-source';
import { createTestApp } from './create-test-app';
import { e2eOwnerUrl } from './e2e-database';
import { E2E_DASHBOARD_ORIGIN } from './env-setup';

const NOW = new Date('2026-10-15T15:00:00.000Z');
const ISSUER = 'https://api.example.com';
const SHOP_ID = '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a01';
const ADMIN_ID = '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a02';
const SESSION_TOKEN = 'e2e-oauth-session-token';
const SESSION_COOKIE = `${SESSION_COOKIE_NAME}=${SESSION_TOKEN}`;
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const CLAUDE_REDIRECT = 'https://claude.ai/api/mcp/auth_callback';
const FORM = 'application/x-www-form-urlencoded';
const RANGE = 'from=2026-10-14&to=2026-10-15';

const VALID_AUTHORIZATION: Readonly<Record<string, string>> = {
  response_type: 'code',
  client_id: CLAUDE_CLIENT_ID,
  redirect_uri: CLAUDE_REDIRECT,
  code_challenge: CHALLENGE,
  code_challenge_method: 'S256',
  state: 'claude-state',
  scope: 'read',
  resource: `${ISSUER}/mcp`,
};

interface TokenAnswer {
  readonly access_token: string;
  readonly refresh_token: string;
}

function searchParameter(location: string, name: string): string {
  return String(new URL(location).searchParams.get(name));
}

describe('OAuth server for the Claude connector', () => {
  let app: NestFastifyApplication;
  let owner: postgres.Sql;
  let clock: FixedClock;

  const authorize = (query: Readonly<Record<string, string>> = VALID_AUTHORIZATION) =>
    app.inject({ method: 'GET', url: `/oauth/authorize?${new URLSearchParams(query).toString()}` });

  const withSession = (method: 'GET' | 'POST' | 'DELETE', url: string) =>
    app.inject({ method, url, headers: { cookie: SESSION_COOKIE, origin: E2E_DASHBOARD_ORIGIN } });

  const withBearer = (
    token: string,
    method: 'GET' | 'POST' | 'PUT',
    url: string,
    payload?: object,
  ) =>
    app.inject({
      method,
      url,
      headers: { authorization: `Bearer ${token}`, origin: E2E_DASHBOARD_ORIGIN },
      ...(payload === undefined ? {} : { payload }),
    });

  const postForm = (url: string, body: string, contentType = FORM) =>
    app.inject({ method: 'POST', url, headers: { 'content-type': contentType }, payload: body });

  const token = (fields: Readonly<Record<string, string>>) =>
    postForm('/oauth/token', new URLSearchParams(fields).toString());

  async function pendingRequest(query = VALID_AUTHORIZATION): Promise<string> {
    const started = await authorize(query);
    expect(started.statusCode).toBe(302);
    return searchParameter(String(started.headers.location), 'request');
  }

  async function approvedCode(): Promise<string> {
    const approved = await withSession(
      'POST',
      `/v1/oauth/requests/${await pendingRequest()}/approve`,
    );
    expect(approved.statusCode).toBe(200);
    return searchParameter(approved.json<{ redirect_to: string }>().redirect_to, 'code');
  }

  async function connect(): Promise<TokenAnswer> {
    const exchanged = await token({
      grant_type: 'authorization_code',
      code: await approvedCode(),
      code_verifier: VERIFIER,
      client_id: CLAUDE_CLIENT_ID,
      redirect_uri: CLAUDE_REDIRECT,
    });
    expect(exchanged.statusCode).toBe(200);
    return exchanged.json<TokenAnswer>();
  }

  const refresh = (refreshToken: string) =>
    token({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLAUDE_CLIENT_ID,
    });

  beforeAll(async () => {
    owner = postgres(e2eOwnerUrl(), { max: 1, onnotice: () => undefined });
    await owner`
      INSERT INTO projects (id, name, allowed_origins, timezone)
      VALUES (${SHOP_ID}, 'OAuth Shop', ${['https://shop.example.com']}, 'UTC')
    `;
    await owner`INSERT INTO admin_users (id, email) VALUES (${ADMIN_ID}, 'oauth@example.com')`;
    await owner`
      INSERT INTO admin_project_access (admin_user_id, project_id) VALUES (${ADMIN_ID}, ${SHOP_ID})
    `;
    await owner`
      INSERT INTO admin_sessions (admin_user_id, token_hash, created_at, last_used_at)
      VALUES (${ADMIN_ID}, ${sha256Hex(SESSION_TOKEN)}, ${NOW}, ${NOW})
    `;
    clock = new FixedClock(NOW);
    app = await createTestApp((builder) =>
      builder
        .overrideProvider(CLOCK)
        .useValue(clock)
        .overrideProvider(CLIENT_METADATA_SOURCE)
        .useValue(new StubClientMetadataSource())
        .overrideProvider(REMOTE_MCP_SETTINGS)
        .useValue({ open: true, issuer: ISSUER, dashboardOrigin: E2E_DASHBOARD_ORIGIN }),
    );
  });

  afterEach(async () => {
    await owner`DELETE FROM oauth_connections WHERE admin_user_id = ${ADMIN_ID}`;
    await owner`DELETE FROM oauth_authorization_requests`;
  });

  afterAll(async () => {
    await app.close();
    await owner.end();
  });

  it('publishes the metadata of the issuer', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/.well-known/oauth-authorization-server',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      issuer: ISSUER,
      authorization_endpoint: `${ISSUER}/oauth/authorize`,
      token_endpoint: `${ISSUER}/oauth/token`,
      revocation_endpoint: `${ISSUER}/oauth/revoke`,
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      client_id_metadata_document_supported: true,
    });
  });

  it('connects Claude end to end: consent, code, tokens, reads and a refresh', async () => {
    const started = await authorize();
    expect(started.statusCode).toBe(302);
    const location = String(started.headers.location);
    expect(location.startsWith(`${E2E_DASHBOARD_ORIGIN}/connect?request=`)).toBe(true);
    const requestId = searchParameter(location, 'request');

    const described = await withSession('GET', `/v1/oauth/requests/${requestId}`);
    expect(described.statusCode).toBe(200);
    expect(described.json()).toMatchObject({
      id: requestId,
      client: { name: 'Claude', host: 'claude.ai' },
      redirect: { host: 'claude.ai', loopback: false },
      scope: 'read',
      projects: [{ id: SHOP_ID, name: 'OAuth Shop' }],
      connection_limit_reached: false,
    });

    const approved = await withSession('POST', `/v1/oauth/requests/${requestId}/approve`);
    const redirectTo = approved.json<{ redirect_to: string }>().redirect_to;
    expect(redirectTo.startsWith(`${CLAUDE_REDIRECT}?`)).toBe(true);
    expect(searchParameter(redirectTo, 'state')).toBe('claude-state');
    expect(searchParameter(redirectTo, 'iss')).toBe(ISSUER);

    const exchanged = await postForm(
      '/oauth/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: searchParameter(redirectTo, 'code'),
        code_verifier: VERIFIER,
        client_id: CLAUDE_CLIENT_ID,
        redirect_uri: CLAUDE_REDIRECT,
        resource: `${ISSUER}/mcp`,
      }).toString(),
      `${FORM}; charset=utf-8`,
    );
    expect(exchanged.statusCode).toBe(200);
    expect(exchanged.headers['cache-control']).toBe('no-store');
    const tokens = exchanged.json<TokenAnswer & { token_type: string; expires_in: number }>();
    expect(tokens).toMatchObject({ token_type: 'Bearer', expires_in: 3600, scope: 'read' });

    const me = await withBearer(tokens.access_token, 'GET', '/v1/me');
    expect(me.statusCode).toBe(200);
    expect(me.json<{ email: string }>().email).toBe('oauth@example.com');
    const overview = await withBearer(
      tokens.access_token,
      'GET',
      `/v1/projects/${SHOP_ID}/overview?${RANGE}`,
    );
    expect(overview.statusCode).toBe(200);

    const listed = await withSession('GET', '/v1/me/connections');
    expect(listed.json()).toEqual({
      connector: { open: true, url: `${ISSUER}/mcp` },
      connections: [
        {
          id: expect.any(String) as string,
          client: { name: 'Claude', host: 'claude.ai' },
          created_at: NOW.toISOString(),
          last_used_at: NOW.toISOString(),
        },
      ],
    });

    const refreshed = await refresh(tokens.refresh_token);
    expect(refreshed.statusCode).toBe(200);
    const next = refreshed.json<TokenAnswer>();
    expect(next.refresh_token).not.toBe(tokens.refresh_token);
    expect((await withBearer(next.access_token, 'GET', '/v1/me')).statusCode).toBe(200);
  });

  it('refuses a wrong PKCE verifier and burns the code', async () => {
    const code = await approvedCode();
    const exchange = (codeVerifier: string) =>
      token({
        grant_type: 'authorization_code',
        code,
        code_verifier: codeVerifier,
        client_id: CLAUDE_CLIENT_ID,
      });

    const wrong = await exchange(`${VERIFIER.slice(0, -1)}A`);
    const right = await exchange(VERIFIER);

    expect(wrong.statusCode).toBe(400);
    expect(wrong.json()).toEqual({
      error: 'invalid_grant',
      error_description: expect.any(String) as string,
    });
    expect(right.json()).toMatchObject({ error: 'invalid_grant' });
  });

  it('drops the connection a code made when the code comes back', async () => {
    const code = await approvedCode();
    const exchange = () =>
      token({
        grant_type: 'authorization_code',
        code,
        code_verifier: VERIFIER,
        client_id: CLAUDE_CLIENT_ID,
      });
    const first = (await exchange()).json<TokenAnswer>();

    const replayed = await exchange();

    expect(replayed.json()).toMatchObject({ error: 'invalid_grant' });
    expect((await withBearer(first.access_token, 'GET', '/v1/me')).statusCode).toBe(401);
  });

  it('never sends a code to an address the client did not register', async () => {
    const response = await authorize({
      ...VALID_AUTHORIZATION,
      redirect_uri: 'https://evil.example.com/cb',
    });
    const unknown = await authorize({
      ...VALID_AUTHORIZATION,
      client_id: 'https://evil.example.com/c',
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers.location).toBeUndefined();
    expect(response.json()).toMatchObject({ error: 'unregistered_redirect_uri' });
    expect(unknown.json()).toMatchObject({ status_code: 400, error: 'unknown_oauth_client' });
  });

  it('sends any other refusal back to the client, and takes Claude Code on a loopback port', async () => {
    const refused = await authorize({ ...VALID_AUTHORIZATION, code_challenge_method: 'plain' });
    const loopback = await authorize({
      ...VALID_AUTHORIZATION,
      client_id: CLAUDE_CODE_CLIENT_ID,
      redirect_uri: 'http://127.0.0.1:53682/callback',
    });

    const location = String(refused.headers.location);
    expect(refused.statusCode).toBe(302);
    expect(location.startsWith(`${CLAUDE_REDIRECT}?`)).toBe(true);
    expect(searchParameter(location, 'error')).toBe('invalid_request');
    expect(searchParameter(location, 'state')).toBe('claude-state');
    const requestId = searchParameter(String(loopback.headers.location), 'request');
    const described = await withSession('GET', `/v1/oauth/requests/${requestId}`);
    expect(described.json()).toMatchObject({
      client: { name: 'Claude Code', host: 'claude.ai' },
      redirect: { host: '127.0.0.1', loopback: true },
    });
  });

  it('lets the person decline, and answers each request once, from the dashboard only', async () => {
    const requestId = await pendingRequest();
    const foreign = await app.inject({
      method: 'POST',
      url: `/v1/oauth/requests/${requestId}/approve`,
      headers: { cookie: SESSION_COOKIE, origin: 'https://evil.example.com' },
    });

    const denied = await withSession('POST', `/v1/oauth/requests/${requestId}/deny`);
    const again = await withSession('POST', `/v1/oauth/requests/${requestId}/approve`);

    expect(foreign.statusCode).toBe(403);
    expect(searchParameter(denied.json<{ redirect_to: string }>().redirect_to, 'error')).toBe(
      'access_denied',
    );
    expect(again.statusCode).toBe(404);
    expect((await withSession('GET', '/v1/oauth/requests/not-a-uuid')).statusCode).toBe(400);
  });

  it('ends the whole connection when a traded refresh token comes back after a minute', async () => {
    const first = await connect();
    const second = (await refresh(first.refresh_token)).json<TokenAnswer>();
    clock.advanceBy(61_000);

    const replayed = await refresh(first.refresh_token);
    const afterwards = await refresh(second.refresh_token);

    expect(replayed.json()).toMatchObject({ error: 'invalid_grant' });
    expect(afterwards.json()).toMatchObject({ error: 'invalid_grant' });
    expect((await withBearer(second.access_token, 'GET', '/v1/me')).statusCode).toBe(401);
  });

  it('stops a connection the person revokes, or the client revokes, at once', async () => {
    const endedByClient = await connect();
    clock.advanceBy(1000);
    const endedByPerson = await connect();
    const listed = await withSession('GET', '/v1/me/connections');
    const [newest] = listed.json<{ connections: { id: string }[] }>().connections;

    const revoked = await withSession('DELETE', `/v1/me/connections/${String(newest?.id)}`);
    const again = await withSession('DELETE', `/v1/me/connections/${String(newest?.id)}`);
    const clientRevoked = await postForm(
      '/oauth/revoke',
      new URLSearchParams({ token: endedByClient.refresh_token }).toString(),
    );

    expect([revoked.statusCode, again.statusCode, clientRevoked.statusCode]).toEqual([
      204, 404, 200,
    ]);
    expect((await withBearer(endedByPerson.access_token, 'GET', '/v1/me')).statusCode).toBe(401);
    expect((await withBearer(endedByClient.access_token, 'GET', '/v1/me')).statusCode).toBe(401);
  });

  it('never writes, signs in or manages anything with a connection token', async () => {
    const { access_token: accessToken } = await connect();

    const refused = [
      await withBearer(accessToken, 'PUT', `/v1/projects/${SHOP_ID}/email-preferences`, {
        weekly_digest: false,
      }),
      await withBearer(accessToken, 'GET', '/v1/me/tokens'),
      await withBearer(accessToken, 'POST', '/v1/me/tokens', { name: 'minted' }),
      await withBearer(accessToken, 'GET', '/v1/me/connections'),
      await withBearer(accessToken, 'GET', '/v1/me/sessions'),
      await withBearer(accessToken, 'POST', '/v1/auth/logout-all'),
    ];

    expect(refused.map((response) => response.statusCode)).toEqual([401, 401, 401, 401, 401, 401]);
  });

  it('answers the token endpoint errors in the shape of RFC 6749', async () => {
    const answers = [
      await token({ grant_type: 'password', client_id: CLAUDE_CLIENT_ID }),
      await token({ client_id: CLAUDE_CLIENT_ID }),
      await postForm('/oauth/token', 'grant_type=refresh_token&grant_type=authorization_code'),
      await token({
        grant_type: 'refresh_token',
        refresh_token: 'x',
        client_id: 'https://evil.example.com/c',
      }),
      await token({ grant_type: 'refresh_token', client_id: CLAUDE_CLIENT_ID }),
    ];

    expect(
      answers.map((answer) => [answer.statusCode, answer.json<{ error: string }>().error]),
    ).toEqual([
      [400, 'unsupported_grant_type'],
      [400, 'invalid_request'],
      [400, 'invalid_request'],
      [401, 'invalid_client'],
      [400, 'invalid_request'],
    ]);
  });
});

describe('OAuth server while the remote MCP is switched off', () => {
  let app: NestFastifyApplication;
  let owner: postgres.Sql;
  const ADMIN = '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a03';
  const SESSION = 'e2e-oauth-closed-session-token';

  beforeAll(async () => {
    owner = postgres(e2eOwnerUrl(), { max: 1, onnotice: () => undefined });
    await owner`INSERT INTO admin_users (id, email) VALUES (${ADMIN}, 'oauth-closed@example.com')`;
    await owner`
      INSERT INTO admin_sessions (admin_user_id, token_hash, created_at, last_used_at)
      VALUES (${ADMIN}, ${sha256Hex(SESSION)}, now(), now())
    `;
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await owner.end();
  });

  it('answers 404 at every OAuth address, and still lists the connections as closed', async () => {
    const cookie = `${SESSION_COOKIE_NAME}=${SESSION}`;
    const answers = [
      await app.inject({ method: 'GET', url: '/.well-known/oauth-authorization-server' }),
      await app.inject({
        method: 'GET',
        url: `/oauth/authorize?${new URLSearchParams(VALID_AUTHORIZATION).toString()}`,
      }),
      await app.inject({
        method: 'POST',
        url: '/oauth/token',
        headers: { 'content-type': FORM },
        payload: 'grant_type=refresh_token',
      }),
      await app.inject({
        method: 'POST',
        url: '/oauth/revoke',
        headers: { 'content-type': FORM },
        payload: 'token=x',
      }),
      await app.inject({
        method: 'GET',
        url: '/v1/oauth/requests/5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a09',
        headers: { cookie },
      }),
    ];
    const connections = await app.inject({
      method: 'GET',
      url: '/v1/me/connections',
      headers: { cookie },
    });

    expect(answers.map((answer) => answer.statusCode)).toEqual([404, 404, 404, 404, 404]);
    expect(answers[0]?.json()).toEqual({
      status_code: 404,
      error: 'not_found',
      message: 'Nothing lives at this address.',
    });
    expect(answers[2]?.json()).toEqual({
      error: 'not_found',
      error_description: 'Nothing lives at this address.',
    });
    expect(connections.json()).toEqual({ connector: { open: false, url: null }, connections: [] });
  });
});
