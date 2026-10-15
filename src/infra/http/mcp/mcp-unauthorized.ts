import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { OAUTH_SCOPE } from '../../../domain/oauth/oauth-policy';
import type { ErrorResponse } from '../ingest/ingest.schemas';
import { protectedResourceMetadataUrl } from './protected-resource.controller';

export const WWW_AUTHENTICATE_HEADER = 'www-authenticate';

export const MCP_UNAUTHORIZED_MESSAGES = {
  missing:
    'Connect Pyxis to this application, or send a Pyxis access token in the Authorization header.',
  refused:
    'The token is unknown, expired or revoked: connect Pyxis again, or send another access token.',
} as const;

const INVALID_TOKEN_DESCRIPTION = 'The token is unknown, expired or revoked.';

export function mcpChallenge(issuer: string, tokenPresented: boolean): string {
  const refusal = tokenPresented
    ? ['error="invalid_token"', `error_description="${INVALID_TOKEN_DESCRIPTION}"`]
    : [];
  const parameters = [
    ...refusal,
    `resource_metadata="${protectedResourceMetadataUrl(issuer)}"`,
    `scope="${OAUTH_SCOPE}"`,
  ];
  return `Bearer ${parameters.join(', ')}`;
}

export class McpUnauthorizedError extends Error {
  readonly challenge: string;

  constructor(issuer: string, tokenPresented: boolean) {
    super(tokenPresented ? MCP_UNAUTHORIZED_MESSAGES.refused : MCP_UNAUTHORIZED_MESSAGES.missing);
    this.name = 'McpUnauthorizedError';
    this.challenge = mcpChallenge(issuer, tokenPresented);
  }
}

@Catch(McpUnauthorizedError)
export class McpUnauthorizedFilter implements ExceptionFilter {
  catch(exception: McpUnauthorizedError, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    const body: ErrorResponse = {
      status_code: HttpStatus.UNAUTHORIZED,
      error: 'unauthenticated',
      message: exception.message,
    };
    void reply
      .status(HttpStatus.UNAUTHORIZED)
      .header(WWW_AUTHENTICATE_HEADER, exception.challenge)
      .send(body);
  }
}
