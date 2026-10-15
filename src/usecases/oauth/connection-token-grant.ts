import { sha256Hex } from '../../domain/auth/hashing';
import { isSuspended } from '../../domain/accounts/account-suspension';
import type { AdminUserRepository } from '../../domain/repositories/admin-user.repository';
import { OAuthProtocolError } from '../../domain/errors/oauth.errors';
import { allowedClient } from '../../domain/oauth/oauth-clients';
import {
  accessTokenExpiry,
  CONNECTION_ACCESS_TOKEN_TTL_SECONDS,
  generateConnectionAccessToken,
  generateConnectionRefreshToken,
  mcpResourceOf,
  OAUTH_SCOPE,
  refreshTokenExpiry,
} from '../../domain/oauth/oauth-policy';
import type { NewConnectionToken } from '../../domain/repositories/oauth-connection.repository';
import type { RandomSource } from '../../domain/services/random-source';

export interface TokenGrant {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresInSeconds: number;
  readonly scope: string;
}

export interface IssuedTokenPair {
  readonly grant: TokenGrant;
  readonly tokens: readonly NewConnectionToken[];
}

export function issueTokenPair(random: RandomSource, issuedAt: Date): IssuedTokenPair {
  const accessToken = generateConnectionAccessToken(random);
  const refreshToken = generateConnectionRefreshToken(random);
  return {
    grant: {
      accessToken,
      refreshToken,
      expiresInSeconds: CONNECTION_ACCESS_TOKEN_TTL_SECONDS,
      scope: OAUTH_SCOPE,
    },
    tokens: [
      { kind: 'access', tokenHash: sha256Hex(accessToken), expiresAt: accessTokenExpiry(issuedAt) },
      {
        kind: 'refresh',
        tokenHash: sha256Hex(refreshToken),
        expiresAt: refreshTokenExpiry(issuedAt),
      },
    ],
  };
}

export function required(value: string | undefined, name: string): string {
  if (value === undefined || value === '') {
    throw new OAuthProtocolError('invalid_request', `${name} is required.`);
  }
  return value;
}

export function requireAllowedClient(clientId: string | undefined): string {
  const id = required(clientId, 'client_id');
  if (allowedClient(id) === null) {
    throw new OAuthProtocolError('invalid_client', 'This application cannot connect to Pyxis.');
  }
  return id;
}

export function requireOwnResource(resource: string | undefined, issuer: string): void {
  const own = mcpResourceOf(issuer);
  if (resource !== undefined && resource !== own) {
    throw new OAuthProtocolError('invalid_target', `The only resource is ${own}.`);
  }
}

export function invalidGrant(): OAuthProtocolError {
  return new OAuthProtocolError(
    'invalid_grant',
    'The grant is wrong, expired, already used or no longer allowed. Connect Pyxis again.',
  );
}

export async function requireActiveAdmin(
  admins: AdminUserRepository,
  adminUserId: string,
): Promise<void> {
  const admin = await admins.findById(adminUserId);
  if (admin === null || isSuspended(admin)) {
    throw invalidGrant();
  }
}
