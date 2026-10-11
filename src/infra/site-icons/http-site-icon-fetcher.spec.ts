import { MAX_SITE_ICON_BYTES, MAX_SITE_PAGE_BYTES } from '../../domain/projects/site-icon';
import {
  type FetchLike,
  HttpSiteIconFetcher,
  MAX_SITE_REDIRECTS,
  type ResolveHost,
  resolveWithDns,
  SITE_ICON_USER_AGENT,
} from './http-site-icon-fetcher';

const ORIGIN = 'https://shop.example.com';
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const PUBLIC = '93.184.215.14';

type Route = () => Response;

function page(...links: string[]): Response {
  return new Response(`<html><head>${links.join('')}</head></html>`, {
    headers: { 'content-type': 'text/html' },
  });
}

function image(bytes: Uint8Array = PNG, headers: Record<string, string> = {}): Response {
  return new Response(bytes, { headers: { 'content-type': 'image/png', ...headers } });
}

function redirect(location: string, status = 301): Response {
  return new Response(null, { status, headers: { location } });
}

function streamOf(chunks: readonly Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => {
        controller.enqueue(chunk);
      });
      controller.close();
    },
  });
}

function site(routes: Record<string, Route>) {
  const requests: { url: string; init: RequestInit }[] = [];
  const send: FetchLike = (url, init) => {
    requests.push({ url, init });
    const route = routes[url];
    return route === undefined
      ? Promise.resolve(new Response('not found', { status: 404 }))
      : Promise.resolve(route());
  };
  return { send, requests };
}

const resolvePublic: ResolveHost = () => Promise.resolve([PUBLIC]);

describe('HttpSiteIconFetcher', () => {
  it('fetches the touch icon declared on the home page', async () => {
    const { send, requests } = site({
      'https://shop.example.com/': () =>
        page('<link rel="apple-touch-icon" href="/apple-icon.png" sizes="180x180">'),
      'https://shop.example.com/apple-icon.png': () => image(),
    });

    const outcome = await new HttpSiteIconFetcher(send, resolvePublic).fetchIcon(ORIGIN);

    expect(outcome).toEqual({
      kind: 'found',
      icon: {
        contentType: 'image/png',
        bytes: PNG,
        sourceUrl: 'https://shop.example.com/apple-icon.png',
      },
    });
    expect(requests[0]?.init).toMatchObject({
      redirect: 'manual',
      headers: { accept: 'text/html', 'user-agent': SITE_ICON_USER_AGENT },
    });
    expect(requests[0]?.init.signal).toBeInstanceOf(AbortSignal);
    expect(requests[1]?.init.headers).toEqual({
      accept: 'image/*',
      'user-agent': SITE_ICON_USER_AGENT,
    });
  });

  it('still tries /favicon.ico when the home page answers an error', async () => {
    const { send } = site({
      'https://shop.example.com/': () => new Response('down', { status: 503 }),
      'https://shop.example.com/favicon.ico': () =>
        image(Uint8Array.from([0x00, 0x00, 0x01, 0x00, 7])),
    });

    const outcome = await new HttpSiteIconFetcher(send, resolvePublic).fetchIcon(ORIGIN);

    expect(outcome).toMatchObject({ kind: 'found', icon: { contentType: 'image/x-icon' } });
  });

  it('reads a home page with no body as a page with no links', async () => {
    const { send } = site({
      'https://shop.example.com/': () => new Response(null, { status: 200 }),
      'https://shop.example.com/favicon.ico': () => image(),
    });

    const outcome = await new HttpSiteIconFetcher(send, resolvePublic).fetchIcon(ORIGIN);

    expect(outcome.kind).toBe('found');
  });

  it('reads only the first part of a very long home page', async () => {
    const link = '<link rel="icon" href="/early.png">';
    const filler = new Uint8Array(MAX_SITE_PAGE_BYTES).fill(0x20);
    const late = new TextEncoder().encode('<link rel="icon" href="/late.png" sizes="512x512">');
    const { send, requests } = site({
      'https://shop.example.com/': () =>
        new Response(streamOf([new TextEncoder().encode(link), filler, late])),
      'https://shop.example.com/early.png': () => image(),
    });

    const outcome = await new HttpSiteIconFetcher(send, resolvePublic).fetchIcon(ORIGIN);

    expect(outcome).toMatchObject({ icon: { sourceUrl: 'https://shop.example.com/early.png' } });
    expect(requests.map((request) => request.url)).not.toContain(
      'https://shop.example.com/late.png',
    );
  });

  it('follows redirects on the same terms, and resolves links against the final page', async () => {
    const { send } = site({
      'https://shop.example.com/': () => redirect('https://www.shop.example.com/'),
      'https://www.shop.example.com/': () => page('<link rel="icon" href="icon.png">'),
      'https://www.shop.example.com/icon.png': () => redirect('/static/icon.png', 308),
      'https://www.shop.example.com/static/icon.png': () => image(),
    });

    const outcome = await new HttpSiteIconFetcher(send, resolvePublic).fetchIcon(ORIGIN);

    expect(outcome).toMatchObject({
      icon: { sourceUrl: 'https://www.shop.example.com/static/icon.png' },
    });
  });

  it('treats a redirect status without a location as the final answer', async () => {
    const { send } = site({
      'https://shop.example.com/': () => new Response(null, { status: 302 }),
      'https://shop.example.com/favicon.ico': () => image(),
    });

    const outcome = await new HttpSiteIconFetcher(send, resolvePublic).fetchIcon(ORIGIN);

    expect(outcome.kind).toBe('found');
  });

  it(`gives up after ${String(MAX_SITE_REDIRECTS)} redirects`, async () => {
    const { send } = site({
      'https://shop.example.com/': () => redirect('https://shop.example.com/a'),
      'https://shop.example.com/a': () => redirect('https://shop.example.com/b'),
      'https://shop.example.com/b': () => redirect('https://shop.example.com/c'),
      'https://shop.example.com/c': () => redirect('https://shop.example.com/d'),
    });

    const outcome = await new HttpSiteIconFetcher(send, resolvePublic).fetchIcon(ORIGIN);

    expect(outcome).toEqual({ kind: 'unreachable', reason: 'more than 3 redirects' });
  });

  it('calls a site it cannot reach unreachable', async () => {
    const send: FetchLike = () => Promise.reject(new TypeError('fetch failed'));

    const outcome = await new HttpSiteIconFetcher(send, resolvePublic).fetchIcon(ORIGIN);

    expect(outcome).toEqual({ kind: 'unreachable', reason: 'fetch failed' });
  });

  it('calls a failure that is not an Error unreachable too', async () => {
    const send: FetchLike = () => Promise.reject(new Error('never sent'));
    const resolve = jest.fn<ReturnType<ResolveHost>, Parameters<ResolveHost>>();
    resolve.mockRejectedValue('no such host');

    const outcome = await new HttpSiteIconFetcher(send, resolve).fetchIcon(ORIGIN);

    expect(outcome).toEqual({ kind: 'unreachable', reason: 'no such host' });
  });

  it.each([
    ['resolves to loopback', ['127.0.0.1']],
    ['resolves to the runtime API on IPv6 loopback', ['::1']],
    ['resolves to a private address among public ones', [PUBLIC, '10.0.0.5']],
    ['resolves to nothing', []],
  ])('refuses a site whose name %s, before sending anything', async (_, addresses) => {
    const { send, requests } = site({});

    const outcome = await new HttpSiteIconFetcher(send, () => Promise.resolve(addresses)).fetchIcon(
      ORIGIN,
    );

    expect(outcome).toEqual({
      kind: 'unreachable',
      reason: 'shop.example.com is not a public address',
    });
    expect(requests).toEqual([]);
  });

  it('refuses a site that is not https', async () => {
    const { send, requests } = site({});

    const outcome = await new HttpSiteIconFetcher(send, resolvePublic).fetchIcon(
      'http://shop.example.com',
    );

    expect(outcome).toEqual({ kind: 'unreachable', reason: 'not https: http:' });
    expect(requests).toEqual([]);
  });

  it('refuses a redirect to an internal host or to plain http', async () => {
    const resolve: ResolveHost = (hostname) =>
      Promise.resolve(hostname === 'metadata.internal' ? ['169.254.169.254'] : [PUBLIC]);
    const toInternal = site({
      'https://shop.example.com/': () => redirect('https://metadata.internal/latest'),
    });
    const toHttp = site({
      'https://shop.example.com/': () => redirect('http://shop.example.com/'),
    });

    expect(await new HttpSiteIconFetcher(toInternal.send, resolve).fetchIcon(ORIGIN)).toEqual({
      kind: 'unreachable',
      reason: 'metadata.internal is not a public address',
    });
    expect(await new HttpSiteIconFetcher(toHttp.send, resolve).fetchIcon(ORIGIN)).toEqual({
      kind: 'unreachable',
      reason: 'not https: http:',
    });
  });

  it('resolves an IPv6 literal host without its brackets', async () => {
    const asked: string[] = [];
    const resolve: ResolveHost = (hostname) => {
      asked.push(hostname);
      return Promise.resolve(['::1']);
    };

    await new HttpSiteIconFetcher(site({}).send, resolve).fetchIcon('https://[::1]:8443');

    expect(asked).toEqual(['::1']);
  });

  it('skips candidates that are not images, too large or missing, and takes the next', async () => {
    const tooLarge = new Uint8Array(MAX_SITE_ICON_BYTES + 1);
    tooLarge.set(PNG);
    const { send } = site({
      'https://shop.example.com/': () =>
        page(
          '<link rel="apple-touch-icon" href="/page.png">',
          '<link rel="icon" href="/declared-large.png" sizes="512x512">',
          '<link rel="icon" href="/streamed-large.png" sizes="256x256">',
        ),
      'https://shop.example.com/page.png': () => new Response('<!doctype html><p>Not found</p>'),
      'https://shop.example.com/declared-large.png': () =>
        image(PNG, { 'content-length': String(MAX_SITE_ICON_BYTES + 1) }),
      'https://shop.example.com/streamed-large.png': () =>
        new Response(streamOf([tooLarge.subarray(0, 50_000), tooLarge.subarray(50_000)])),
      'https://shop.example.com/favicon.ico': () => image(),
    });

    const outcome = await new HttpSiteIconFetcher(send, resolvePublic).fetchIcon(ORIGIN);

    expect(outcome).toMatchObject({ icon: { sourceUrl: 'https://shop.example.com/favicon.ico' } });
  });

  it('skips a candidate that answers an error', async () => {
    const { send } = site({
      'https://shop.example.com/': () => page('<link rel="icon" href="/gone.png">'),
      'https://shop.example.com/gone.png': () => new Response('gone', { status: 410 }),
      'https://shop.example.com/favicon.ico': () => image(),
    });

    const outcome = await new HttpSiteIconFetcher(send, resolvePublic).fetchIcon(ORIGIN);

    expect(outcome).toMatchObject({ icon: { sourceUrl: 'https://shop.example.com/favicon.ico' } });
  });

  it('uses the platform fetch and DNS when none are given', async () => {
    const outcome = await new HttpSiteIconFetcher().fetchIcon('http://shop.example.com');

    expect(outcome).toEqual({ kind: 'unreachable', reason: 'not https: http:' });
  });

  it('answers none when the site answers but shows no usable icon', async () => {
    const { send } = site({
      'https://shop.example.com/': () => page('<link rel="icon" href="/icon.svg">'),
      'https://shop.example.com/favicon.ico': () => new Response(null, { status: 200 }),
    });

    const outcome = await new HttpSiteIconFetcher(send, resolvePublic).fetchIcon(ORIGIN);

    expect(outcome).toEqual({ kind: 'none' });
  });

  it('answers none when every candidate fails to load', async () => {
    let calls = 0;
    const send: FetchLike = (url) => {
      calls += 1;
      return url === 'https://shop.example.com/'
        ? Promise.resolve(page('<link rel="icon" href="/icon.png">'))
        : Promise.reject(new Error('connection reset'));
    };

    const outcome = await new HttpSiteIconFetcher(send, resolvePublic).fetchIcon(ORIGIN);

    expect(outcome).toEqual({ kind: 'none' });
    expect(calls).toBe(3);
  });
});

describe('resolveWithDns', () => {
  it('lists every address of a name', async () => {
    const addresses = await resolveWithDns('localhost');

    expect(addresses.length).toBeGreaterThan(0);
    expect(addresses.every((address) => ['127.0.0.1', '::1'].includes(address))).toBe(true);
  });
});
