import { DomainError } from './domain.error';

export const OAUTH_ERROR_CODES = [
  'invalid_request',
  'invalid_client',
  'invalid_grant',
  'unsupported_grant_type',
  'invalid_target',
] as const;

export type OAuthErrorCode = (typeof OAUTH_ERROR_CODES)[number];

export class OAuthProtocolError extends DomainError {
  constructor(
    readonly code: OAuthErrorCode,
    description: string,
  ) {
    super(description);
  }
}

export class RemoteMcpClosedError extends DomainError {
  readonly code = 'not_found';

  constructor() {
    super('Nothing lives at this address.');
  }
}

export class UnknownOAuthClientError extends DomainError {
  readonly code = 'unknown_oauth_client';

  constructor() {
    super('This application cannot connect to Pyxis.');
  }
}

export class UnregisteredRedirectError extends DomainError {
  readonly code = 'unregistered_redirect_uri';

  constructor() {
    super('The application asked to return to an address it never registered.');
  }
}

export class AuthorizationRequestNotFoundError extends DomainError {
  readonly code = 'authorization_request_not_found';

  constructor() {
    super('The connection request does not exist, has expired or was already answered.');
  }
}

export class TooManyConnectionsError extends DomainError {
  readonly code = 'too_many_connections';

  constructor(limit: number) {
    super(`An admin keeps at most ${String(limit)} connected applications: revoke one first.`);
  }
}

export class ConnectionNotFoundError extends DomainError {
  readonly code = 'connection_not_found';

  constructor() {
    super('The connection does not exist, is not yours, or was already revoked.');
  }
}
