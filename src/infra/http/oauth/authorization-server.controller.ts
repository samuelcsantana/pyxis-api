import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Query,
  Redirect,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { OAuthProtocolError } from '../../../domain/errors/oauth.errors';
import { CODE_CHALLENGE_METHOD, OAUTH_SCOPE } from '../../../domain/oauth/oauth-policy';
import {
  REMOTE_MCP_SETTINGS,
  type RemoteMcpSettings,
  requireOpen,
} from '../../../domain/oauth/remote-mcp-settings';
import { BeginAuthorizationUseCase } from '../../../usecases/oauth/begin-authorization.usecase';
import type { TokenGrant } from '../../../usecases/oauth/connection-token-grant';
import { ExchangeAuthorizationCodeUseCase } from '../../../usecases/oauth/exchange-authorization-code.usecase';
import { RefreshConnectionTokensUseCase } from '../../../usecases/oauth/refresh-connection-tokens.usecase';
import { RevokeOAuthTokenUseCase } from '../../../usecases/oauth/revoke-oauth-token.usecase';
import { errorResponseSchema } from '../ingest/ingest.schemas';
import { ClientAddressThrottlerGuard } from '../rate-limit/client-address-throttler.guard';
import {
  OAUTH_AUTHORIZE_REQUESTS_PER_WINDOW,
  OAUTH_RATE_WINDOW_MS,
  OAUTH_THROTTLER,
  skipThrottlersExcept,
} from '../rate-limit/rate-limits';
import { SchemaPipe } from '../schema-pipe';
import { OAuthErrorFilter } from './oauth-error.filter';
import {
  type AuthorizationQueryBody,
  authorizationQuerySchema,
  type AuthorizationServerMetadataBody,
  authorizationServerMetadataSchema,
  oauthErrorSchema,
  type RevocationRequestBody,
  revocationRequestSchema,
  type TokenRequestBody,
  tokenRequestSchema,
  type TokenResponseBody,
  tokenResponseSchema,
} from './oauth.schemas';

export const AUTHORIZATION_SERVER_METADATA_PATH = '.well-known/oauth-authorization-server';
export const AUTHORIZE_PATH = 'oauth/authorize';
export const TOKEN_PATH = 'oauth/token';
export const REVOKE_PATH = 'oauth/revoke';
export const FORM_CONTENT_TYPE = 'application/x-www-form-urlencoded';

export interface RedirectAnswer {
  readonly url: string;
}

export function authorizationServerMetadata(issuer: string): AuthorizationServerMetadataBody {
  return {
    issuer,
    authorization_endpoint: `${issuer}/${AUTHORIZE_PATH}`,
    token_endpoint: `${issuer}/${TOKEN_PATH}`,
    revocation_endpoint: `${issuer}/${REVOKE_PATH}`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: [CODE_CHALLENGE_METHOD],
    token_endpoint_auth_methods_supported: ['none'],
    revocation_endpoint_auth_methods_supported: ['none'],
    scopes_supported: [OAUTH_SCOPE],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
  };
}

function tokenResponse(grant: TokenGrant): TokenResponseBody {
  return {
    access_token: grant.accessToken,
    token_type: 'Bearer',
    expires_in: grant.expiresInSeconds,
    refresh_token: grant.refreshToken,
    scope: OAUTH_SCOPE,
  };
}

@ApiTags('oauth')
@Controller()
@SkipThrottle(skipThrottlersExcept(OAUTH_THROTTLER))
export class AuthorizationServerController {
  constructor(
    @Inject(REMOTE_MCP_SETTINGS) private readonly settings: RemoteMcpSettings,
    private readonly beginAuthorization: BeginAuthorizationUseCase,
    private readonly exchangeCode: ExchangeAuthorizationCodeUseCase,
    private readonly refreshTokens: RefreshConnectionTokensUseCase,
    private readonly revokeToken: RevokeOAuthTokenUseCase,
  ) {}

  @Get(AUTHORIZATION_SERVER_METADATA_PATH)
  @ApiOperation({
    summary: 'The authorization server metadata (RFC 8414)',
    description:
      'Clients register by the address of their metadata document, never dynamically; only ' +
      'Claude and Claude Code are allowed. 404 while the remote MCP is switched off.',
  })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: authorizationServerMetadataSchema })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, standardSchema: errorResponseSchema })
  metadata(): AuthorizationServerMetadataBody {
    return authorizationServerMetadata(requireOpen(this.settings).issuer);
  }

  @Get(AUTHORIZE_PATH)
  @Redirect()
  @UseGuards(ClientAddressThrottlerGuard)
  @Throttle({
    [OAUTH_THROTTLER]: { limit: OAUTH_AUTHORIZE_REQUESTS_PER_WINDOW, ttl: OAUTH_RATE_WINDOW_MS },
  })
  @ApiOperation({
    summary: 'Start a connection: the browser goes to the consent page of the dashboard',
    description:
      'PKCE with S256 is required. An unknown client or a return address its document does not ' +
      'list is answered here, never redirected; any other refusal goes back to the client.',
  })
  @ApiResponse({
    status: HttpStatus.FOUND,
    description: 'To the consent page, or back with error.',
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, standardSchema: errorResponseSchema })
  @ApiResponse({ status: HttpStatus.TOO_MANY_REQUESTS, standardSchema: errorResponseSchema })
  async authorize(
    @Query({ schema: authorizationQuerySchema, pipes: [new SchemaPipe(authorizationQuerySchema)] })
    query: AuthorizationQueryBody,
  ): Promise<RedirectAnswer> {
    return {
      url: await this.beginAuthorization.execute({
        responseType: query.response_type,
        clientId: query.client_id,
        redirectUri: query.redirect_uri,
        codeChallenge: query.code_challenge,
        codeChallengeMethod: query.code_challenge_method,
        state: query.state,
        resource: query.resource,
      }),
    };
  }

  @Post(TOKEN_PATH)
  @HttpCode(HttpStatus.OK)
  @UseGuards(ClientAddressThrottlerGuard)
  @UseFilters(OAuthErrorFilter)
  @ApiConsumes(FORM_CONTENT_TYPE)
  @ApiOperation({
    summary: 'Trade a code, or a refresh token, for the tokens of a connection',
    description:
      'A refresh token is traded once: a replay within a minute gets another pair, a later one ' +
      'ends the whole connection. Errors follow RFC 6749, section 5.2.',
  })
  @ApiResponse({ status: HttpStatus.OK, standardSchema: tokenResponseSchema })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, standardSchema: oauthErrorSchema })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, standardSchema: oauthErrorSchema })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, standardSchema: oauthErrorSchema })
  @ApiResponse({ status: HttpStatus.TOO_MANY_REQUESTS, standardSchema: oauthErrorSchema })
  async token(
    @Body({ schema: tokenRequestSchema, pipes: [new SchemaPipe(tokenRequestSchema)] })
    body: TokenRequestBody,
  ): Promise<TokenResponseBody> {
    requireOpen(this.settings);
    switch (body.grant_type) {
      case 'authorization_code':
        return tokenResponse(
          await this.exchangeCode.execute({
            code: body.code,
            codeVerifier: body.code_verifier,
            clientId: body.client_id,
            redirectUri: body.redirect_uri,
            resource: body.resource,
          }),
        );
      case 'refresh_token':
        return tokenResponse(
          await this.refreshTokens.execute({
            refreshToken: body.refresh_token,
            clientId: body.client_id,
            resource: body.resource,
          }),
        );
      case undefined:
        throw new OAuthProtocolError('invalid_request', 'grant_type is required.');
      default:
        throw new OAuthProtocolError(
          'unsupported_grant_type',
          'Only authorization_code and refresh_token are supported.',
        );
    }
  }

  @Post(REVOKE_PATH)
  @HttpCode(HttpStatus.OK)
  @UseGuards(ClientAddressThrottlerGuard)
  @UseFilters(OAuthErrorFilter)
  @ApiConsumes(FORM_CONTENT_TYPE)
  @ApiOperation({
    summary: 'End a connection with either of its tokens (RFC 7009)',
    description: 'Answers 200 whether or not the token was known.',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'The connection no longer works.' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, standardSchema: oauthErrorSchema })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, standardSchema: oauthErrorSchema })
  @ApiResponse({ status: HttpStatus.TOO_MANY_REQUESTS, standardSchema: oauthErrorSchema })
  async revoke(
    @Body({ schema: revocationRequestSchema, pipes: [new SchemaPipe(revocationRequestSchema)] })
    body: RevocationRequestBody,
  ): Promise<void> {
    await this.revokeToken.execute({ token: body.token });
  }
}
