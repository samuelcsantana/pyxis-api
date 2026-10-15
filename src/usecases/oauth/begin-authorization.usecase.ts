import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  UnknownOAuthClientError,
  UnregisteredRedirectError,
} from '../../domain/errors/oauth.errors';
import { authorizationResponseUrl, consentUrl } from '../../domain/oauth/authorization-response';
import {
  allowedClient,
  type ClientMetadata,
  isRegisteredRedirect,
} from '../../domain/oauth/oauth-clients';
import {
  AUTHORIZATION_REQUEST_TTL_MS,
  CODE_CHALLENGE_METHOD,
  CODE_CHALLENGE_PATTERN,
  later,
  MAX_REDIRECT_URI_LENGTH,
  MAX_STATE_LENGTH,
  mcpResourceOf,
} from '../../domain/oauth/oauth-policy';
import {
  type OpenRemoteMcpSettings,
  REMOTE_MCP_SETTINGS,
  type RemoteMcpSettings,
  requireOpen,
} from '../../domain/oauth/remote-mcp-settings';
import {
  AUTHORIZATION_REQUEST_REPOSITORY,
  type AuthorizationRequestRepository,
} from '../../domain/repositories/authorization-request.repository';
import {
  CLIENT_METADATA_SOURCE,
  type ClientMetadataSource,
} from '../../domain/services/client-metadata-source';
import { CLOCK, type Clock } from '../../domain/services/clock';

export const AUTHORIZATION_RESPONSE_TYPE = 'code';

export interface AuthorizationQuery {
  readonly responseType?: string;
  readonly clientId?: string;
  readonly redirectUri?: string;
  readonly codeChallenge?: string;
  readonly codeChallengeMethod?: string;
  readonly state?: string;
  readonly resource?: string;
}

interface Refusal {
  readonly error: string;
  readonly description: string;
}

type CheckedQuery = { readonly refusal: Refusal } | { readonly codeChallenge: string };

function refused(error: string, description: string): CheckedQuery {
  return { refusal: { error, description } };
}

function checkedQuery(query: AuthorizationQuery, settings: OpenRemoteMcpSettings): CheckedQuery {
  if (query.responseType !== AUTHORIZATION_RESPONSE_TYPE) {
    return refused('unsupported_response_type', 'Only response_type=code is supported.');
  }
  if (query.codeChallengeMethod !== CODE_CHALLENGE_METHOD) {
    return refused('invalid_request', 'PKCE with code_challenge_method=S256 is required.');
  }
  if (query.codeChallenge === undefined || !CODE_CHALLENGE_PATTERN.test(query.codeChallenge)) {
    return refused('invalid_request', 'code_challenge must be an S256 challenge.');
  }
  if (query.state !== undefined && query.state.length > MAX_STATE_LENGTH) {
    return refused('invalid_request', 'state is too long.');
  }
  const resource = mcpResourceOf(settings.issuer);
  if (query.resource !== undefined && query.resource !== resource) {
    return refused('invalid_target', `The only resource is ${resource}.`);
  }
  return { codeChallenge: query.codeChallenge };
}

function registeredRedirect(metadata: ClientMetadata, redirectUri: string | undefined): string {
  if (
    redirectUri === undefined ||
    redirectUri.length > MAX_REDIRECT_URI_LENGTH ||
    !isRegisteredRedirect(metadata, redirectUri)
  ) {
    throw new UnregisteredRedirectError();
  }
  return redirectUri;
}

@Injectable()
export class BeginAuthorizationUseCase {
  private readonly logger = new Logger(BeginAuthorizationUseCase.name);

  constructor(
    @Inject(REMOTE_MCP_SETTINGS) private readonly settings: RemoteMcpSettings,
    @Inject(CLIENT_METADATA_SOURCE) private readonly clients: ClientMetadataSource,
    @Inject(AUTHORIZATION_REQUEST_REPOSITORY)
    private readonly requests: AuthorizationRequestRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(query: AuthorizationQuery): Promise<string> {
    const settings = requireOpen(this.settings);
    const client = query.clientId === undefined ? null : allowedClient(query.clientId);
    if (client === null) {
      throw new UnknownOAuthClientError();
    }
    const redirectUri = registeredRedirect(
      await this.clients.metadataOf(client),
      query.redirectUri,
    );
    const checked = checkedQuery(query, settings);
    const state = query.state ?? null;
    if ('refusal' in checked) {
      return authorizationResponseUrl(
        redirectUri,
        { error: checked.refusal.error, error_description: checked.refusal.description, state },
        settings.issuer,
      );
    }
    const now = this.clock.now();
    const request = await this.requests.create({
      clientId: client.id,
      redirectUri,
      state,
      codeChallenge: checked.codeChallenge,
      createdAt: now,
      expiresAt: later(now, AUTHORIZATION_REQUEST_TTL_MS),
    });
    this.logger.log({
      message: 'oauth.authorization_started',
      requestId: request.id,
      clientId: client.id,
    });
    return consentUrl(settings.dashboardOrigin, request.id);
  }
}
