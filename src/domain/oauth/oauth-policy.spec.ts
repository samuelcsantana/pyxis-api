import { SequenceRandomSource } from '../../test-utils/sequence-random-source';
import {
  accessTokenExpiry,
  AUTHORIZATION_CODE_PATTERN,
  codeChallengeOf,
  CONNECTION_ACCESS_TOKEN_PATTERN,
  CONNECTION_REFRESH_TOKEN_PATTERN,
  connectionAccessTokenFromAuthorization,
  connectionNeedsTouch,
  generateAuthorizationCode,
  generateConnectionAccessToken,
  generateConnectionRefreshToken,
  idleConnectionCutoff,
  isConnectionIdle,
  isWithinReplayGrace,
  later,
  mcpResourceOf,
  refreshTokenExpiry,
  verifierMatches,
} from './oauth-policy';

const NOW = new Date('2026-10-15T12:00:00.000Z');
const RFC_7636_VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const RFC_7636_CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

describe('oauth policy', () => {
  it('draws 256 random bits for every code and token, behind the prefix of its kind', () => {
    const random = () => new SequenceRandomSource([255, 0, 62, 63]);

    expect(generateAuthorizationCode(random())).toMatch(AUTHORIZATION_CODE_PATTERN);
    expect(generateConnectionAccessToken(random())).toMatch(CONNECTION_ACCESS_TOKEN_PATTERN);
    expect(generateConnectionRefreshToken(random())).toMatch(CONNECTION_REFRESH_TOKEN_PATTERN);
    expect(generateConnectionAccessToken(random()).startsWith('pyxis_oat_')).toBe(true);
    expect(generateConnectionRefreshToken(random()).startsWith('pyxis_ort_')).toBe(true);
  });

  it('derives the S256 challenge of RFC 7636 appendix B', () => {
    expect(codeChallengeOf(RFC_7636_VERIFIER)).toBe(RFC_7636_CHALLENGE);
    expect(verifierMatches(RFC_7636_VERIFIER, RFC_7636_CHALLENGE)).toBe(true);
  });

  it('refuses a verifier of the wrong challenge or outside the allowed alphabet and length', () => {
    expect(verifierMatches(`${RFC_7636_VERIFIER}x`, RFC_7636_CHALLENGE)).toBe(false);
    expect(verifierMatches(RFC_7636_VERIFIER, 'short')).toBe(false);
    expect(verifierMatches('short', codeChallengeOf('short'))).toBe(false);
    const withSpace = `${'a'.repeat(42)} `;
    expect(verifierMatches(withSpace, codeChallengeOf(withSpace))).toBe(false);
  });

  it('names the MCP endpoint of the issuer as the only resource', () => {
    expect(mcpResourceOf('https://api.example.com')).toBe('https://api.example.com/mcp');
  });

  it('lets an access token live one hour and a refresh token as long as an idle connection', () => {
    expect(accessTokenExpiry(NOW)).toEqual(new Date('2026-10-15T13:00:00.000Z'));
    expect(refreshTokenExpiry(NOW)).toEqual(new Date('2027-01-13T12:00:00.000Z'));
    expect(later(NOW, -1000)).toEqual(new Date('2026-10-15T11:59:59.000Z'));
  });

  it('ends a connection after ninety days without use', () => {
    const cutoff = idleConnectionCutoff(NOW);

    expect(cutoff).toEqual(new Date('2026-07-17T12:00:00.000Z'));
    expect(isConnectionIdle(cutoff, NOW)).toBe(true);
    expect(isConnectionIdle(later(cutoff, 1), NOW)).toBe(false);
  });

  it('records a use at most every five minutes', () => {
    expect(connectionNeedsTouch(later(NOW, -5 * 60 * 1000), NOW)).toBe(true);
    expect(connectionNeedsTouch(later(NOW, -5 * 60 * 1000 + 1), NOW)).toBe(false);
  });

  it('forgives a replayed refresh token for one minute after its rotation, never later', () => {
    expect(isWithinReplayGrace(later(NOW, -60 * 1000), NOW)).toBe(true);
    expect(isWithinReplayGrace(later(NOW, -60 * 1000 - 1), NOW)).toBe(false);
  });

  it('reads only a well-formed connection access token from the authorization header', () => {
    const token = `pyxis_oat_${'A'.repeat(43)}`;

    expect(connectionAccessTokenFromAuthorization(`Bearer ${token}`)).toBe(token);
    expect(connectionAccessTokenFromAuthorization(`Bearer pyxis_at_${'A'.repeat(32)}`)).toBeNull();
    expect(connectionAccessTokenFromAuthorization(`Bearer pyxis_ort_${'A'.repeat(43)}`)).toBeNull();
    expect(connectionAccessTokenFromAuthorization(undefined)).toBeNull();
  });
});
