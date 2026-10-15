import { z } from 'zod';
import {
  CONNECTION_ACCESS_TOKEN_PATTERN,
  CONNECTION_REFRESH_TOKEN_PATTERN,
  OAUTH_SCOPE,
} from '../../../domain/oauth/oauth-policy';

export const MAX_OAUTH_PARAMETER_LENGTH = 2048;

const parameter = (description: string) =>
  z.string().max(MAX_OAUTH_PARAMETER_LENGTH).optional().describe(description);

export const authorizationQuerySchema = z
  .looseObject({
    response_type: parameter('Always code'),
    client_id: parameter(
      'The address of the client metadata document; only Claude and Claude Code',
    ),
    redirect_uri: parameter('One of the addresses the client metadata document lists'),
    code_challenge: parameter('The S256 challenge of the PKCE code verifier'),
    code_challenge_method: parameter('Always S256'),
    state: parameter('Sent back unchanged, at most 512 characters'),
    scope: parameter('Ignored: a connection always reads, and only reads'),
    resource: parameter('When sent, the MCP endpoint of this API'),
  })
  .meta({ id: 'OAuthAuthorizationQuery' });

export const tokenRequestSchema = z
  .looseObject({
    grant_type: parameter('authorization_code or refresh_token'),
    code: parameter('The code from the authorization response'),
    code_verifier: parameter('The PKCE verifier of the code challenge'),
    client_id: parameter('The client that received the code or the refresh token'),
    redirect_uri: parameter('When sent, the same address as in the authorization request'),
    refresh_token: parameter('A pyxis_ort_ token, traded once'),
    resource: parameter('When sent, the MCP endpoint of this API'),
    scope: parameter('Ignored: a connection always reads, and only reads'),
  })
  .meta({ id: 'OAuthTokenRequest' });

export const revocationRequestSchema = z
  .looseObject({
    token: parameter('An access or refresh token of the connection to end'),
    token_type_hint: parameter('Ignored: either token ends the whole connection'),
    client_id: parameter('Ignored: holding the token is enough to end it'),
  })
  .meta({ id: 'OAuthRevocationRequest' });

export const tokenResponseSchema = z
  .strictObject({
    access_token: z.string().regex(CONNECTION_ACCESS_TOKEN_PATTERN),
    token_type: z.literal('Bearer'),
    expires_in: z.int().describe('Seconds the access token lives: one hour'),
    refresh_token: z
      .string()
      .regex(CONNECTION_REFRESH_TOKEN_PATTERN)
      .describe('Traded once for the next pair; presenting it again later ends the connection'),
    scope: z.literal(OAUTH_SCOPE),
  })
  .meta({
    id: 'OAuthTokenResponse',
    description: 'The tokens of a connection, read-only, for the dashboard queries.',
  });

export const oauthErrorSchema = z
  .strictObject({
    error: z.string(),
    error_description: z.string(),
  })
  .meta({ id: 'OAuthError', description: 'An error in the shape of RFC 6749, section 5.2.' });

export const authorizationServerMetadataSchema = z
  .strictObject({
    issuer: z.url(),
    authorization_endpoint: z.url(),
    token_endpoint: z.url(),
    revocation_endpoint: z.url(),
    response_types_supported: z.array(z.literal('code')),
    grant_types_supported: z.array(z.enum(['authorization_code', 'refresh_token'])),
    code_challenge_methods_supported: z.array(z.literal('S256')),
    token_endpoint_auth_methods_supported: z.array(z.literal('none')),
    revocation_endpoint_auth_methods_supported: z.array(z.literal('none')),
    scopes_supported: z.array(z.literal(OAUTH_SCOPE)),
    client_id_metadata_document_supported: z.literal(true),
    authorization_response_iss_parameter_supported: z.literal(true),
  })
  .meta({ id: 'AuthorizationServerMetadata', description: 'RFC 8414 metadata of this issuer.' });

export const authorizationRequestIdSchema = z.uuid();

export const authorizationRequestSchema = z
  .strictObject({
    id: z.uuid(),
    client: z.strictObject({
      name: z.string().describe('Our name for the client, never the one its document declares'),
      host: z.string().describe('The host of the client metadata document address'),
    }),
    redirect: z.strictObject({
      host: z.string().describe('Where the browser returns with the code'),
      loopback: z.boolean().describe('True when the code goes to a program on this computer'),
    }),
    scope: z.literal(OAUTH_SCOPE),
    expires_at: z.iso.datetime(),
    projects: z.array(z.strictObject({ id: z.uuid(), name: z.string() })),
    connection_limit_reached: z.boolean(),
  })
  .meta({
    id: 'AuthorizationRequest',
    description:
      'A connection request waiting for the signed-in admin, as the consent page shows it.',
  });

export const authorizationDecisionSchema = z
  .strictObject({
    redirect_to: z.url().describe('Where the dashboard sends the browser next'),
  })
  .meta({ id: 'AuthorizationDecision' });

export const connectionIdSchema = z.uuid();

export const connectionsSchema = z
  .strictObject({
    connector: z.strictObject({
      open: z.boolean().describe('Whether applications can connect now'),
      url: z.url().nullable().describe('The address to add as a connector; null while closed'),
    }),
    connections: z.array(
      z.strictObject({
        id: z.uuid(),
        client: z.strictObject({ name: z.string(), host: z.string() }),
        created_at: z.iso.datetime(),
        last_used_at: z.iso
          .datetime()
          .describe('Recorded at most every five minutes, and at every token refresh'),
      }),
    ),
  })
  .meta({
    id: 'Connections',
    description:
      'The applications connected by the signed-in admin, the newest first: neither revoked nor ' +
      'idle for ninety days.',
  });

export type AuthorizationQueryBody = z.infer<typeof authorizationQuerySchema>;
export type TokenRequestBody = z.infer<typeof tokenRequestSchema>;
export type RevocationRequestBody = z.infer<typeof revocationRequestSchema>;
export type TokenResponseBody = z.infer<typeof tokenResponseSchema>;
export type AuthorizationServerMetadataBody = z.infer<typeof authorizationServerMetadataSchema>;
export type AuthorizationRequestBody = z.infer<typeof authorizationRequestSchema>;
export type AuthorizationDecisionBody = z.infer<typeof authorizationDecisionSchema>;
export type ConnectionsBody = z.infer<typeof connectionsSchema>;
