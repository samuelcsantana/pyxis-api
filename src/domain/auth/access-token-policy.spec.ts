import type { AccessToken } from '../entities/access-token.entity';
import { SequenceRandomSource } from '../../test-utils/sequence-random-source';
import {
  ACCESS_TOKEN_PATTERN,
  ACCESS_TOKEN_TOUCH_INTERVAL_MS,
  accessTokenExpiry,
  accessTokenFromAuthorization,
  accessTokenNeedsTouch,
  generateAccessToken,
  isAccessTokenActive,
} from './access-token-policy';

const CREATED_AT = new Date('2026-10-14T12:00:00.000Z');
const TOKEN = `pyxis_at_${'A'.repeat(32)}`;

function token(changes: Partial<AccessToken> = {}): AccessToken {
  return {
    id: 'token-1',
    adminUserId: 'admin-1',
    name: 'Claude Code',
    createdAt: CREATED_AT,
    lastUsedAt: null,
    expiresAt: new Date('2027-01-12T12:00:00.000Z'),
    ...changes,
  };
}

describe('generateAccessToken', () => {
  it('builds pyxis_at_ plus 32 letters and digits from the random source', () => {
    const generated = generateAccessToken(
      new SequenceRandomSource(Array.from({ length: 62 }, (_, index) => index)),
    );

    expect(generated).toMatch(ACCESS_TOKEN_PATTERN);
    expect(generated).toBe('pyxis_at_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef');
  });
});

describe('accessTokenExpiry', () => {
  it.each([
    [30, '2026-11-13T12:00:00.000Z'],
    [90, '2027-01-12T12:00:00.000Z'],
    [365, '2027-10-14T12:00:00.000Z'],
  ] as const)('ends %i days after it was created', (days, expected) => {
    expect(accessTokenExpiry(CREATED_AT, days)).toEqual(new Date(expected));
  });
});

describe('isAccessTokenActive', () => {
  it('holds until the last millisecond before the expiry and not at it', () => {
    const expiring = token({ expiresAt: new Date('2026-11-13T12:00:00.000Z') });

    expect(isAccessTokenActive(expiring, new Date('2026-11-13T11:59:59.999Z'))).toBe(true);
    expect(isAccessTokenActive(expiring, new Date('2026-11-13T12:00:00.000Z'))).toBe(false);
  });
});

describe('accessTokenNeedsTouch', () => {
  const now = new Date('2026-10-14T13:00:00.000Z');

  it('records the first use', () => {
    expect(accessTokenNeedsTouch(token(), now)).toBe(true);
  });

  it('skips the write while the last recorded use is recent', () => {
    const recent = new Date(now.getTime() - ACCESS_TOKEN_TOUCH_INTERVAL_MS + 1);

    expect(accessTokenNeedsTouch(token({ lastUsedAt: recent }), now)).toBe(false);
  });

  it('records the use again once the interval has passed', () => {
    const old = new Date(now.getTime() - ACCESS_TOKEN_TOUCH_INTERVAL_MS);

    expect(accessTokenNeedsTouch(token({ lastUsedAt: old }), now)).toBe(true);
  });
});

describe('accessTokenFromAuthorization', () => {
  it('reads an access token from a bearer header', () => {
    expect(accessTokenFromAuthorization(`Bearer ${TOKEN}`)).toBe(TOKEN);
  });

  it.each([
    [undefined],
    [TOKEN],
    [`Basic ${TOKEN}`],
    [`Bearer pyxis_sk_${'A'.repeat(32)}`],
    [`Bearer pyxis_at_${'A'.repeat(31)}`],
    ['Bearer '],
  ])('ignores %j', (header) => {
    expect(accessTokenFromAuthorization(header)).toBeNull();
  });
});
