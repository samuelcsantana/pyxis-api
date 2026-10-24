import type { FastifyRequest } from 'fastify';
import { sha256Hex } from '../../../domain/auth/hashing';
import type { AccessToken } from '../../../domain/entities/access-token.entity';
import type { AdminSession } from '../../../domain/entities/admin-session.entity';
import type { OAuthConnection } from '../../../domain/entities/oauth-connection.entity';
import { UnauthenticatedError } from '../../../domain/errors/auth.errors';
import { readerOf } from './authenticated-reader';

const SINCE = new Date('2026-10-23T12:00:00.000Z');

function session(id: string): AdminSession {
  return { id, adminUserId: 'admin-1', createdAt: SINCE, lastUsedAt: SINCE, device: null };
}

function token(id: string): AccessToken {
  return {
    id,
    adminUserId: 'admin-1',
    name: 'CI',
    createdAt: SINCE,
    lastUsedAt: null,
    expiresAt: SINCE,
  };
}

function connection(id: string): OAuthConnection {
  return { id, adminUserId: 'admin-1', clientId: 'claude', createdAt: SINCE, lastUsedAt: SINCE };
}

describe('readerOf', () => {
  it('names the session, the access token or the connection that was authenticated', () => {
    expect(readerOf({ session: session('s-1') } as FastifyRequest)).toBe('session:s-1');
    expect(readerOf({ accessToken: token('t-1') } as FastifyRequest)).toBe('token:t-1');
    expect(readerOf({ oauthConnection: connection('c-1') } as FastifyRequest)).toBe(
      'connection:c-1',
    );
  });

  it('names an MCP caller by the kind and the hash of the bearer it authenticated', () => {
    const caller = (secret: string) =>
      ({
        mcpCaller: { bearer: { kind: 'connection', secret }, issuer: 'https://api.example.com' },
      }) as FastifyRequest;

    expect(readerOf(caller('pyxis_oat_a'))).toBe(`mcp-connection:${sha256Hex('pyxis_oat_a')}`);
    expect(readerOf(caller('pyxis_oat_a'))).not.toContain('pyxis_oat_a');
  });

  it('refuses a request that nothing authenticated', () => {
    expect(() => readerOf({} as FastifyRequest)).toThrow(UnauthenticatedError);
  });
});
