import { lookup } from 'node:dns/promises';
import { Logger } from '@nestjs/common';
import {
  iconCandidates,
  MAX_SITE_ICON_BYTES,
  MAX_SITE_PAGE_BYTES,
  sniffIconType,
} from '../../domain/projects/site-icon';
import type {
  SiteIcon,
  SiteIconFetcher,
  SiteIconOutcome,
} from '../../domain/services/site-icon-fetcher';
import { isPublicAddress } from './public-address';

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;
export type ResolveHost = (hostname: string) => Promise<readonly string[]>;

export const SITE_REQUEST_TIMEOUT_MS = 5_000;
export const MAX_SITE_REDIRECTS = 3;
export const SITE_ICON_USER_AGENT = 'PyxisSiteIcon/1.0 (+https://pyxis-analytics.dev)';

const SECURE_PROTOCOL = 'https:';
const IPV6_BRACKETS = /^\[|\]$/g;
const REDIRECT_STATUSES: ReadonlySet<number> = new Set([301, 302, 303, 307, 308]);
const PAGE_ACCEPT = 'text/html';
const ICON_ACCEPT = 'image/*';

type Overflow = 'truncate' | 'refuse';

interface Fetched {
  readonly url: string;
  readonly ok: boolean;
  readonly bytes: Uint8Array;
}

export class SiteRequestRefusedError extends Error {}

export async function resolveWithDns(hostname: string): Promise<readonly string[]> {
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  return addresses.map((entry) => entry.address);
}

function concatenate(chunks: readonly Uint8Array[], length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function readUpTo(
  response: Response,
  limit: number,
  overflow: Overflow,
): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length') ?? Number.NaN);
  if (overflow === 'refuse' && declared > limit) {
    throw new SiteRequestRefusedError(`larger than ${String(limit)} bytes`);
  }
  if (response.body === null) {
    return new Uint8Array();
  }
  const reader = (response.body as ReadableStream<Uint8Array>).getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      return concatenate(chunks, length);
    }
    if (length + value.byteLength > limit) {
      await reader.cancel();
      if (overflow === 'refuse') {
        throw new SiteRequestRefusedError(`larger than ${String(limit)} bytes`);
      }
      chunks.push(value.subarray(0, limit - length));
      return concatenate(chunks, limit);
    }
    chunks.push(value);
    length += value.byteLength;
  }
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class HttpSiteIconFetcher implements SiteIconFetcher {
  private readonly logger = new Logger(HttpSiteIconFetcher.name);

  constructor(
    private readonly send: FetchLike = fetch,
    private readonly resolve: ResolveHost = resolveWithDns,
  ) {}

  async fetchIcon(origin: string): Promise<SiteIconOutcome> {
    let page: Fetched;
    try {
      page = await this.get(
        new URL('/', origin).href,
        MAX_SITE_PAGE_BYTES,
        PAGE_ACCEPT,
        'truncate',
      );
    } catch (error) {
      return { kind: 'unreachable', reason: reasonOf(error) };
    }
    const html = page.ok ? new TextDecoder().decode(page.bytes) : '';
    for (const candidate of iconCandidates(html, page.url)) {
      const icon = await this.bestEffortIcon(candidate);
      if (icon !== null) {
        return { kind: 'found', icon };
      }
    }
    return { kind: 'none' };
  }

  private async bestEffortIcon(url: string): Promise<SiteIcon | null> {
    try {
      const fetched = await this.get(url, MAX_SITE_ICON_BYTES, ICON_ACCEPT, 'refuse');
      const contentType = fetched.ok ? sniffIconType(fetched.bytes) : null;
      return contentType === null
        ? null
        : { contentType, bytes: fetched.bytes, sourceUrl: fetched.url };
    } catch (error) {
      this.logger.warn({ message: 'site_icon.candidate_failed', url, reason: reasonOf(error) });
      return null;
    }
  }

  private async get(
    url: string,
    limit: number,
    accept: string,
    overflow: Overflow,
  ): Promise<Fetched> {
    let current = new URL(url);
    for (let redirects = 0; redirects <= MAX_SITE_REDIRECTS; redirects += 1) {
      await this.refuseUnlessPublic(current);
      const response = await this.send(current.href, {
        redirect: 'manual',
        headers: { accept, 'user-agent': SITE_ICON_USER_AGENT },
        signal: AbortSignal.timeout(SITE_REQUEST_TIMEOUT_MS),
      });
      const location = response.headers.get('location');
      if (REDIRECT_STATUSES.has(response.status) && location !== null) {
        current = new URL(location, current);
        continue;
      }
      return {
        url: current.href,
        ok: response.ok,
        bytes: response.ok ? await readUpTo(response, limit, overflow) : new Uint8Array(),
      };
    }
    throw new SiteRequestRefusedError(`more than ${String(MAX_SITE_REDIRECTS)} redirects`);
  }

  private async refuseUnlessPublic(url: URL): Promise<void> {
    if (url.protocol !== SECURE_PROTOCOL) {
      throw new SiteRequestRefusedError(`not https: ${url.protocol}`);
    }
    const addresses = await this.resolve(url.hostname.replace(IPV6_BRACKETS, ''));
    if (addresses.length === 0 || !addresses.every(isPublicAddress)) {
      throw new SiteRequestRefusedError(`${url.hostname} is not a public address`);
    }
  }
}
