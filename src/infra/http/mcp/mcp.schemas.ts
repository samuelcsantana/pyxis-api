import { z } from 'zod';
import { OAUTH_SCOPE } from '../../../domain/oauth/oauth-policy';

export const protectedResourceMetadataSchema = z
  .strictObject({
    resource: z.url().describe('The MCP endpoint of this API, the audience of every token'),
    authorization_servers: z.array(z.url()).describe('This API itself'),
    scopes_supported: z.array(z.literal(OAUTH_SCOPE)),
    bearer_methods_supported: z.array(z.literal('header')),
    resource_name: z.string(),
  })
  .meta({
    id: 'ProtectedResourceMetadata',
    description: 'RFC 9728 metadata of the MCP endpoint, the same at both addresses.',
  });

export type ProtectedResourceMetadataBody = z.infer<typeof protectedResourceMetadataSchema>;
