import type { AllowedClient, ClientMetadata } from '../domain/oauth/oauth-clients';
import type { ClientMetadataSource } from '../domain/services/client-metadata-source';

export class StubClientMetadataSource implements ClientMetadataSource {
  metadataOf(client: AllowedClient): Promise<ClientMetadata> {
    return Promise.resolve(client.knownMetadata);
  }
}
