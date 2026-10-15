import type { AllowedClient, ClientMetadata } from '../oauth/oauth-clients';

export interface ClientMetadataSource {
  metadataOf(client: AllowedClient): Promise<ClientMetadata>;
}

export const CLIENT_METADATA_SOURCE = Symbol('ClientMetadataSource');
