import { accessTokenFromAuthorization } from '../../../domain/auth/access-token-policy';
import { connectionAccessTokenFromAuthorization } from '../../../domain/oauth/oauth-policy';

export type McpBearer =
  | { readonly kind: 'access_token'; readonly secret: string }
  | { readonly kind: 'connection'; readonly secret: string };

export interface McpCaller {
  readonly bearer: McpBearer;
  readonly issuer: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    mcpCaller?: McpCaller;
  }
}

export function mcpBearerOf(authorization: string | undefined): McpBearer | null {
  const accessToken = accessTokenFromAuthorization(authorization);
  if (accessToken !== null) {
    return { kind: 'access_token', secret: accessToken };
  }
  const connectionToken = connectionAccessTokenFromAuthorization(authorization);
  return connectionToken === null ? null : { kind: 'connection', secret: connectionToken };
}
