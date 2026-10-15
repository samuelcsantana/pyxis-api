import { Logger } from '@nestjs/common';
import { z } from 'zod';
import {
  type AllowedClient,
  type ClientMetadata,
  isLoopbackRedirect,
} from '../../domain/oauth/oauth-clients';
import { MAX_REDIRECT_URI_LENGTH } from '../../domain/oauth/oauth-policy';
import type { ClientMetadataSource } from '../../domain/services/client-metadata-source';
import type { Clock } from '../../domain/services/clock';

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export const CLIENT_METADATA_TIMEOUT_MS = 5_000;
export const CLIENT_METADATA_CACHE_MS = 24 * 60 * 60 * 1000;
export const MAX_CLIENT_METADATA_CHARACTERS = 16 * 1024;
export const MAX_REDIRECT_URIS = 10;
export const CLIENT_METADATA_USER_AGENT = 'PyxisOAuth/1.0 (+https://pyxis-analytics.dev)';

const OK = 200;

const redirectUriSchema = z
  .string()
  .max(MAX_REDIRECT_URI_LENGTH)
  .refine(
    (uri) => URL.canParse(uri) && (new URL(uri).protocol === 'https:' || isLoopbackRedirect(uri)),
  );

const clientMetadataSchema = z.looseObject({
  client_id: z.string(),
  redirect_uris: z.array(redirectUriSchema).min(1).max(MAX_REDIRECT_URIS),
  token_endpoint_auth_method: z.literal('none'),
});

class ClientMetadataRefusedError extends Error {}

function parsedMetadata(client: AllowedClient, body: string): ClientMetadata {
  if (body.length > MAX_CLIENT_METADATA_CHARACTERS) {
    throw new ClientMetadataRefusedError('larger than the limit');
  }
  const document = clientMetadataSchema.safeParse(JSON.parse(body));
  if (!document.success || document.data.client_id !== client.id) {
    throw new ClientMetadataRefusedError('not a metadata document of this client');
  }
  return { clientId: client.id, redirectUris: document.data.redirect_uris };
}

export class HttpClientMetadataFetcher {
  private readonly logger = new Logger(HttpClientMetadataFetcher.name);

  constructor(private readonly fetchDocument: FetchLike = fetch) {}

  async tryFetch(client: AllowedClient): Promise<ClientMetadata | null> {
    try {
      const response = await this.fetchDocument(client.id, {
        redirect: 'manual',
        signal: AbortSignal.timeout(CLIENT_METADATA_TIMEOUT_MS),
        headers: { accept: 'application/json', 'user-agent': CLIENT_METADATA_USER_AGENT },
      });
      if (response.status !== OK) {
        throw new ClientMetadataRefusedError(`answered ${String(response.status)}`);
      }
      return parsedMetadata(client, await response.text());
    } catch (error) {
      this.logger.warn({
        message: 'oauth.client_metadata_unavailable',
        clientId: client.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}

interface CachedMetadata {
  readonly metadata: ClientMetadata;
  readonly fetchedAt: number;
}

export class CachingClientMetadataSource implements ClientMetadataSource {
  private readonly cached = new Map<string, CachedMetadata>();

  constructor(
    private readonly fetcher: HttpClientMetadataFetcher,
    private readonly clock: Clock,
  ) {}

  async metadataOf(client: AllowedClient): Promise<ClientMetadata> {
    const now = this.clock.now().getTime();
    const cached = this.cached.get(client.id);
    if (cached !== undefined && now - cached.fetchedAt < CLIENT_METADATA_CACHE_MS) {
      return cached.metadata;
    }
    const fetched = await this.fetcher.tryFetch(client);
    if (fetched === null) {
      return cached?.metadata ?? client.knownMetadata;
    }
    this.cached.set(client.id, { metadata: fetched, fetchedAt: now });
    return fetched;
  }
}
