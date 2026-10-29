import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import postgres from 'postgres';
import { sha256Hex } from '../../src/domain/auth/hashing';
import { CLAUDE_CLIENT_ID } from '../../src/domain/oauth/oauth-clients';
import { REMOTE_MCP_SETTINGS } from '../../src/domain/oauth/remote-mcp-settings';
import { CLIENT_METADATA_SOURCE } from '../../src/domain/services/client-metadata-source';
import { CLOCK } from '../../src/domain/services/clock';
import { SESSION_COOKIE_NAME } from '../../src/infra/http/auth/session-cookie';
import { MCP_MESSAGES_PER_WINDOW } from '../../src/infra/http/rate-limit/rate-limits';
import { FixedClock } from '../../src/test-utils/fixed-clock';
import { StubClientMetadataSource } from '../../src/test-utils/stub-client-metadata-source';
import { createTestApp } from './create-test-app';
import { e2eOwnerUrl } from './e2e-database';
import { E2E_DASHBOARD_ORIGIN } from './env-setup';

const NOW = new Date('2026-10-15T15:00:00.000Z');
const ISSUER = 'https://api.example.com';
const METADATA_URL = `${ISSUER}/.well-known/oauth-protected-resource/mcp`;
const SHOP_ID = '6f7a8b9c-0d1e-4f2a-8b3c-4d5e6f7a8b01';
const ADMIN_ID = '6f7a8b9c-0d1e-4f2a-8b3c-4d5e6f7a8b02';
const SESSION_TOKEN = 'e2e-mcp-session-token';
const SESSION_COOKIE = `${SESSION_COOKIE_NAME}=${SESSION_TOKEN}`;
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const CLAUDE_REDIRECT = 'https://claude.ai/api/mcp/auth_callback';
const MCP_E2E_STATE = 'mcp-e2e-state';
const SPACING_VARIANTS = 3;
const MCP_HEADERS = {
  accept: 'application/json, text/event-stream',
  'content-type': 'application/json',
  'mcp-protocol-version': '2025-11-25',
};
const INITIALIZE = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-11-25',
    capabilities: {},
    clientInfo: { name: 'e2e', version: '1.0.0' },
  },
};

interface ToolAnswer {
  readonly result: { readonly content: readonly { text: string }[]; readonly isError?: boolean };
}

function toolCall(name: string, args: object = {}, id = 2) {
  return { jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } };
}

function toolText(answer: ToolAnswer): string {
  return answer.result.content.map(({ text }) => text).join('\n');
}

function searchParameter(location: string, name: string): string {
  return String(new URL(location).searchParams.get(name));
}

describe('the remote MCP endpoint', () => {
  let app: NestFastifyApplication;
  let owner: postgres.Sql;

  const post = (message: object, headers: Readonly<Record<string, string>> = {}) =>
    app.inject({
      method: 'POST',
      url: '/mcp',
      headers: { ...MCP_HEADERS, ...headers },
      payload: JSON.stringify(message),
    });

  const withBearer = (token: string) => ({ authorization: `Bearer ${token}` });

  const withSession = (method: 'GET' | 'POST' | 'DELETE', url: string, payload?: object) =>
    app.inject({
      method,
      url,
      headers: { cookie: SESSION_COOKIE, origin: E2E_DASHBOARD_ORIGIN },
      ...(payload === undefined ? {} : { payload }),
    });

  async function personalToken(name: string): Promise<string> {
    const created = await withSession('POST', '/v1/me/tokens', { name });
    expect(created.statusCode).toBe(201);
    return created.json<{ token: string }>().token;
  }

  async function connect(): Promise<string> {
    const started = await app.inject({
      method: 'GET',
      url: `/oauth/authorize?${new URLSearchParams({
        response_type: 'code',
        client_id: CLAUDE_CLIENT_ID,
        redirect_uri: CLAUDE_REDIRECT,
        code_challenge: CHALLENGE,
        code_challenge_method: 'S256',
        state: MCP_E2E_STATE,
        resource: `${ISSUER}/mcp`,
      }).toString()}`,
    });
    const requestId = searchParameter(String(started.headers.location), 'request');
    const approved = await withSession('POST', `/v1/oauth/requests/${requestId}/approve`);
    const code = searchParameter(approved.json<{ redirect_to: string }>().redirect_to, 'code');
    const exchanged = await app.inject({
      method: 'POST',
      url: '/oauth/token',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        code_verifier: VERIFIER,
        client_id: CLAUDE_CLIENT_ID,
        redirect_uri: CLAUDE_REDIRECT,
        resource: `${ISSUER}/mcp`,
      }).toString(),
    });
    expect(exchanged.statusCode).toBe(200);
    return exchanged.json<{ access_token: string }>().access_token;
  }

  beforeAll(async () => {
    owner = postgres(e2eOwnerUrl(), { max: 1, onnotice: () => undefined });
    await owner`
      INSERT INTO projects (id, name, allowed_origins, timezone)
      VALUES (${SHOP_ID}, 'MCP Shop', ${['https://shop.example.com']}, 'America/Sao_Paulo')
    `;
    await owner`INSERT INTO admin_users (id, email) VALUES (${ADMIN_ID}, 'mcp@example.com')`;
    await owner`
      INSERT INTO admin_project_access (admin_user_id, project_id) VALUES (${ADMIN_ID}, ${SHOP_ID})
    `;
    await owner`
      INSERT INTO admin_sessions (admin_user_id, token_hash, created_at, last_used_at)
      VALUES (${ADMIN_ID}, ${sha256Hex(SESSION_TOKEN)}, ${NOW}, ${NOW})
    `;
    app = await createTestApp((builder) =>
      builder
        .overrideProvider(CLOCK)
        .useValue(new FixedClock(NOW))
        .overrideProvider(CLIENT_METADATA_SOURCE)
        .useValue(new StubClientMetadataSource())
        .overrideProvider(REMOTE_MCP_SETTINGS)
        .useValue({ open: true, issuer: ISSUER, dashboardOrigin: E2E_DASHBOARD_ORIGIN }),
    );
  });

  afterEach(async () => {
    await owner`DELETE FROM oauth_connections WHERE admin_user_id = ${ADMIN_ID}`;
    await owner`DELETE FROM oauth_authorization_requests WHERE state = ${MCP_E2E_STATE}`;
    await owner`DELETE FROM admin_access_tokens WHERE admin_user_id = ${ADMIN_ID}`;
  });

  afterAll(async () => {
    await app.close();
    await owner.end();
  });

  it('publishes the same resource metadata at both addresses', async () => {
    const forMcp = await app.inject({
      method: 'GET',
      url: '/.well-known/oauth-protected-resource/mcp',
    });
    const atRoot = await app.inject({
      method: 'GET',
      url: '/.well-known/oauth-protected-resource',
    });

    expect(forMcp.statusCode).toBe(200);
    expect(forMcp.json()).toEqual({
      resource: `${ISSUER}/mcp`,
      authorization_servers: [ISSUER],
      scopes_supported: ['read'],
      bearer_methods_supported: ['header'],
      resource_name: 'Pyxis',
    });
    expect(atRoot.json()).toEqual(forMcp.json());
  });

  it('sends a caller without a token to the metadata, which leads to this issuer', async () => {
    const refused = await post(INITIALIZE);

    expect(refused.statusCode).toBe(401);
    expect(refused.headers['www-authenticate']).toBe(
      `Bearer resource_metadata="${METADATA_URL}", scope="read"`,
    );
    const metadata = await app.inject({
      method: 'GET',
      url: new URL(METADATA_URL).pathname,
    });
    const [issuer] = metadata.json<{ authorization_servers: string[] }>().authorization_servers;
    const server = await app.inject({
      method: 'GET',
      url: '/.well-known/oauth-authorization-server',
    });
    expect(server.json<{ issuer: string }>().issuer).toBe(issuer);
  });

  it('reads the projects of the person who connected Claude', async () => {
    const token = await connect();

    const initialized = await post(INITIALIZE, withBearer(token));
    expect(initialized.statusCode).toBe(200);
    expect(initialized.json()).toMatchObject({
      id: 1,
      result: { serverInfo: { name: 'pyxis' }, protocolVersion: '2025-11-25' },
    });

    const listed = await post({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, withBearer(token));
    const tools = listed.json<{ result: { tools: { name: string }[] } }>().result.tools;
    expect(tools.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        'list_projects',
        'overview',
        'funnel',
        'visit_timeline',
        'property_summary',
      ]),
    );
    expect(tools).toHaveLength(16);

    const projects = await post(toolCall('list_projects'), withBearer(token));
    expect(projects.statusCode).toBe(200);
    expect(JSON.parse(toolText(projects.json<ToolAnswer>()))).toMatchObject({
      report: {
        projects: [{ id: SHOP_ID, name: 'MCP Shop', today: '2026-10-15', last_event_at: null }],
      },
    });

    const overview = await post(
      toolCall('overview', { project_id: SHOP_ID, from: '2026-10-09', to: '2026-10-15' }, 3),
      withBearer(token),
    );
    const answer = overview.json<ToolAnswer>();
    expect(answer.result.isError).toBeUndefined();
    const { report } = JSON.parse(toolText(answer)) as {
      report: { comparison_cutoff: string; days: { date: string }[] };
    };
    expect(report.comparison_cutoff).toBe('12:00:00.000');
    expect(report.days.map(({ date }) => date)).toContain('2026-10-15');
  });

  it('serves a personal access token sent in the header, with no OAuth', async () => {
    const token = await personalToken('Cursor');

    const projects = await post(toolCall('list_projects'), withBearer(token));

    expect(projects.statusCode).toBe(200);
    expect(toolText(projects.json<ToolAnswer>())).toContain(SHOP_ID);
  });

  it('sums up a numeric event property through the median tool', async () => {
    const token = await personalToken('Median');

    const summary = await post(
      toolCall('property_summary', {
        project_id: SHOP_ID,
        from: '2026-10-09',
        to: '2026-10-15',
        event: 'article_read_100',
        key: 'seconds',
        by: 'post',
        device: 'desktop',
      }),
      withBearer(token),
    );

    const answer = summary.json<ToolAnswer>();
    expect(answer.result.isError).toBeUndefined();
    expect(JSON.parse(toolText(answer))).toMatchObject({
      report: {
        name: 'article_read_100',
        key: 'seconds',
        by: 'post',
        overall: { events: 0, median: null, p25: null, p75: null },
        groups: [],
        other_count: 0,
      },
    });
  });

  it('describes the cities and the reach, and filters the visits by a city within its region', async () => {
    const token = await personalToken('Cities');
    const range = { project_id: SHOP_ID, from: '2026-10-09', to: '2026-10-15' };

    const listed = await post({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, withBearer(token));
    const devicesTool = listed
      .json<{ result: { tools: { name: string; description: string }[] } }>()
      .result.tools.find(({ name }) => name === 'devices');
    expect(devicesTool?.description).toContain('reach counts the visits of the range');

    const devices = await post(toolCall('devices', range), withBearer(token));
    const { report } = JSON.parse(toolText(devices.json<ToolAnswer>())) as {
      report: { cities: unknown[]; reach: { cities: number } };
    };
    expect(Array.isArray(report.cities)).toBe(true);
    expect(report.reach.cities).toBe(0);

    const inCity = await post(
      toolCall('visits', { ...range, region: 'BR-SP', city: 'Campinas' }),
      withBearer(token),
    );
    expect(inCity.json<ToolAnswer>().result.isError).toBeUndefined();

    const withoutRegion = await post(
      toolCall('visits', { ...range, city: 'Campinas' }),
      withBearer(token),
    );
    const refused = withoutRegion.json<ToolAnswer>();
    expect(refused.result.isError).toBe(true);
    expect(toolText(refused)).toBe('city is matched inside a region: give region too.');
  });

  it('answers times in the project time zone, the same instants the API answers in UTC', async () => {
    const token = await personalToken('Times');
    const fromApi = await withSession('GET', `/v1/projects/${SHOP_ID}/settings`);

    const settings = await post(
      toolCall('project_settings', { project_id: SHOP_ID }),
      withBearer(token),
    );

    const utc = fromApi.json<{ created_at: string }>().created_at;
    const { report } = JSON.parse(toolText(settings.json<ToolAnswer>())) as {
      report: { timezone: string; created_at: string };
    };
    expect(report.timezone).toBe('America/Sao_Paulo');
    expect(report.created_at.endsWith('-03:00')).toBe(true);
    expect(new Date(report.created_at).toISOString()).toBe(utc);
  });

  it('tells a client whose connection was revoked that its token is invalid', async () => {
    const token = await connect();
    const listed = await withSession('GET', '/v1/me/connections');
    const [connection] = listed.json<{ connections: { id: string }[] }>().connections;
    await withSession('DELETE', `/v1/me/connections/${String(connection?.id)}`);

    const refused = await post(INITIALIZE, withBearer(token));

    expect(refused.statusCode).toBe(401);
    expect(refused.headers['www-authenticate']).toBe(
      'Bearer error="invalid_token", error_description="The token is unknown, expired or ' +
        `revoked.", resource_metadata="${METADATA_URL}", scope="read"`,
    );
  });

  it('never reads the dashboard session cookie', async () => {
    const refused = await post(INITIALIZE, { cookie: SESSION_COOKIE });

    expect(refused.statusCode).toBe(401);
  });

  it('refuses a request sent by a web page', async () => {
    const token = await personalToken('Web page');

    const refused = await post(INITIALIZE, {
      ...withBearer(token),
      origin: 'https://evil.example.com',
    });

    expect(refused.statusCode).toBe(403);
  });

  it.each(['GET', 'DELETE'] as const)('answers 405 to a %s', async (method) => {
    const token = await personalToken(method);

    const refused = await app.inject({ method, url: '/mcp', headers: withBearer(token) });

    expect(refused.statusCode).toBe(405);
    expect(refused.headers.allow).toBe('POST');
  });

  it('refuses a body that is not JSON, or too large to be a message', async () => {
    const token = await personalToken('Large');
    const malformed = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: { ...MCP_HEADERS, ...withBearer(token) },
      payload: '{"jsonrpc":',
    });
    const large = await post({ ...INITIALIZE, padding: 'x'.repeat(40 * 1024) }, withBearer(token));

    expect(malformed.statusCode).toBe(400);
    expect(large.statusCode).toBe(413);
  });

  it('counts tool reads against the read routes and messages against the endpoint', async () => {
    const reads = await personalToken('Reads');
    for (let call = 0; call < 60; call += 1) {
      const answer = await post(toolCall('list_projects', {}, call), withBearer(reads));
      expect(answer.json<ToolAnswer>().result.isError).toBeUndefined();
    }

    const limited = await post(toolCall('list_projects', {}, 60), withBearer(reads));

    expect(limited.statusCode).toBe(200);
    expect(toolText(limited.json<ToolAnswer>())).toMatch(/^Too many requests/);

    const messages = await personalToken('Messages');
    const list = { jsonrpc: '2.0', id: 1, method: 'tools/list' };
    for (let message = 0; message < 120; message += 1) {
      expect((await post(list, withBearer(messages))).statusCode).toBe(200);
    }
    expect((await post(list, withBearer(messages))).statusCode).toBe(429);
  });

  it('counts a token once however the spaces of its authorization header vary', async () => {
    const token = await personalToken('Spaced');
    const list = { jsonrpc: '2.0', id: 1, method: 'tools/list' };
    const spaced = (message: number) => ({
      authorization: `Bearer${' '.repeat(1 + (message % SPACING_VARIANTS))}${token}`,
    });
    for (let message = 0; message < MCP_MESSAGES_PER_WINDOW; message += 1) {
      expect((await post(list, spaced(message))).statusCode).toBe(200);
    }

    expect((await post(list, spaced(MCP_MESSAGES_PER_WINDOW))).statusCode).toBe(429);
  });
});

describe('the remote MCP endpoint while switched off', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    ['POST', '/mcp'],
    ['GET', '/.well-known/oauth-protected-resource/mcp'],
    ['GET', '/.well-known/oauth-protected-resource'],
  ] as const)('answers 404 to %s %s, even without a token', async (method, url) => {
    const response = await app.inject({
      method,
      url,
      headers: MCP_HEADERS,
      payload: method === 'POST' ? JSON.stringify(INITIALIZE) : undefined,
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers['www-authenticate']).toBeUndefined();
  });
});
