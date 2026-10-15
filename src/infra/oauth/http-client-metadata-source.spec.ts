import { Logger } from '@nestjs/common';
import {
  allowedClient,
  type AllowedClient,
  CLAUDE_CLIENT_ID,
  CLAUDE_CODE_CLIENT_ID,
} from '../../domain/oauth/oauth-clients';
import { FixedClock } from '../../test-utils/fixed-clock';
import {
  CachingClientMetadataSource,
  CLIENT_METADATA_CACHE_MS,
  CLIENT_METADATA_USER_AGENT,
  type FetchLike,
  HttpClientMetadataFetcher,
} from './http-client-metadata-source';

const NOW = new Date('2026-10-15T12:00:00.000Z');
function knownClient(clientId: string): AllowedClient {
  const client = allowedClient(clientId);
  if (client === null) {
    throw new Error(`${clientId} is not an allowed client`);
  }
  return client;
}

const CLAUDE = knownClient(CLAUDE_CLIENT_ID);
const CLAUDE_CODE = knownClient(CLAUDE_CODE_CLIENT_ID);
const MOVED_CALLBACK = 'https://claude.com/api/mcp/auth_callback';

function documentOf(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    client_id: CLAUDE_CLIENT_ID,
    client_name: 'Claude',
    redirect_uris: [MOVED_CALLBACK],
    grant_types: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_method: 'none',
    ...overrides,
  });
}

function answering(body: string, status = 200): jest.MockedFunction<FetchLike> {
  return jest.fn<Promise<Response>, Parameters<FetchLike>>(() =>
    Promise.resolve(new Response(body, { status })),
  );
}

let warnings: unknown[];

beforeEach(() => {
  warnings = [];
  jest.spyOn(Logger.prototype, 'warn').mockImplementation((message: unknown) => {
    warnings.push(message);
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('HttpClientMetadataFetcher', () => {
  it('fetches the document at the client id without following redirects', async () => {
    const fetchDocument = answering(documentOf());

    const metadata = await new HttpClientMetadataFetcher(fetchDocument).tryFetch(CLAUDE);

    expect(metadata).toEqual({ clientId: CLAUDE_CLIENT_ID, redirectUris: [MOVED_CALLBACK] });
    const [url, init] = fetchDocument.mock.calls[0] ?? [];
    expect(url).toBe(CLAUDE_CLIENT_ID);
    expect(init).toMatchObject({
      redirect: 'manual',
      headers: { accept: 'application/json', 'user-agent': CLIENT_METADATA_USER_AGENT },
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('accepts loopback redirects for a command-line client', async () => {
    const fetchDocument = answering(
      documentOf({
        client_id: CLAUDE_CODE_CLIENT_ID,
        redirect_uris: ['http://localhost/callback', 'http://127.0.0.1/callback'],
      }),
    );

    const metadata = await new HttpClientMetadataFetcher(fetchDocument).tryFetch(CLAUDE_CODE);

    expect(metadata?.redirectUris).toEqual([
      'http://localhost/callback',
      'http://127.0.0.1/callback',
    ]);
  });

  it.each([
    ['a redirect', answering('', 302)],
    ['a server error', answering('', 500)],
    ['a body that is not JSON', answering('<html>')],
    ['an oversized body', answering(documentOf({ padding: 'x'.repeat(17_000) }))],
    ['another client id', answering(documentOf({ client_id: 'https://evil.example.com/c' }))],
    [
      'a client secret method',
      answering(documentOf({ token_endpoint_auth_method: 'client_secret_basic' })),
    ],
    ['no redirect address', answering(documentOf({ redirect_uris: [] }))],
    [
      'a plain-http redirect address',
      answering(documentOf({ redirect_uris: ['http://claude.ai/cb'] })),
    ],
    [
      'a redirect address that is not a URL',
      answering(documentOf({ redirect_uris: ['callback'] })),
    ],
  ])('refuses %s, logging why', async (_case, fetchDocument) => {
    expect(await new HttpClientMetadataFetcher(fetchDocument).tryFetch(CLAUDE)).toBeNull();
    expect(warnings).toEqual([
      {
        message: 'oauth.client_metadata_unavailable',
        clientId: CLAUDE_CLIENT_ID,
        error: expect.any(String) as string,
      },
    ]);
  });

  it('gives up on a network failure, naming it', async () => {
    const fetchDocument = jest.fn<Promise<Response>, Parameters<FetchLike>>(() =>
      Promise.reject(new TypeError('fetch failed')),
    );
    const throwing = jest
      .fn<Promise<Response>, Parameters<FetchLike>>()
      .mockRejectedValue('timeout');

    expect(await new HttpClientMetadataFetcher(fetchDocument).tryFetch(CLAUDE)).toBeNull();
    expect(await new HttpClientMetadataFetcher(throwing).tryFetch(CLAUDE)).toBeNull();
    expect(warnings).toMatchObject([{ error: 'fetch failed' }, { error: 'timeout' }]);
  });

  it('uses the global fetch by default', () => {
    expect(new HttpClientMetadataFetcher()).toBeInstanceOf(HttpClientMetadataFetcher);
  });
});

describe('CachingClientMetadataSource', () => {
  it('keeps a fetched document for a day, then fetches it again', async () => {
    const fetchDocument = answering(documentOf());
    const clock = new FixedClock(NOW);
    const source = new CachingClientMetadataSource(
      new HttpClientMetadataFetcher(fetchDocument),
      clock,
    );

    await source.metadataOf(CLAUDE);
    clock.advanceBy(CLIENT_METADATA_CACHE_MS - 1);
    await source.metadataOf(CLAUDE);
    expect(fetchDocument).toHaveBeenCalledTimes(1);

    clock.advanceBy(1);
    expect(await source.metadataOf(CLAUDE)).toEqual({
      clientId: CLAUDE_CLIENT_ID,
      redirectUris: [MOVED_CALLBACK],
    });
    expect(fetchDocument).toHaveBeenCalledTimes(2);
  });

  it('falls back to the last good copy, then to the copy known when this was built', async () => {
    const clock = new FixedClock(NOW);
    const fetchDocument = answering(documentOf());
    const source = new CachingClientMetadataSource(
      new HttpClientMetadataFetcher(fetchDocument),
      clock,
    );
    await source.metadataOf(CLAUDE);
    fetchDocument.mockImplementation(() => Promise.resolve(new Response('', { status: 503 })));
    clock.advanceBy(CLIENT_METADATA_CACHE_MS);

    expect((await source.metadataOf(CLAUDE)).redirectUris).toEqual([MOVED_CALLBACK]);
    expect(await source.metadataOf(CLAUDE_CODE)).toEqual(CLAUDE_CODE.knownMetadata);
  });
});
