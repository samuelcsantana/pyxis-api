import { InvalidShareLinkError } from '../errors/share-link.errors';
import { SequenceRandomSource } from '../../test-utils/sequence-random-source';
import {
  generateShareUnlock,
  MAX_FAILED_UNLOCKS,
  MAX_SHARE_PASSWORD_INPUT_UNITS,
  MAX_SHARE_PASSWORD_LENGTH,
  MIN_SHARE_PASSWORD_LENGTH,
  requireSharePassword,
  secondsUntilUnlockable,
  SHARE_UNLOCK_LIFETIME_MS,
  SHARE_UNLOCK_PATTERN,
  shareUnlockExpiry,
  shareUnlockFromAuthorization,
  UNLOCK_FAILURE_WINDOW_MS,
} from './share-unlock';

const NOW = new Date('2026-11-05T12:00:00.000Z');
const MINUTE_MS = 60_000;

describe('the share link password limits', () => {
  it('are 8 to 128 characters, unlocks of eight hours, and 50 wrong passwords per 15 minutes', () => {
    expect({
      MIN_SHARE_PASSWORD_LENGTH,
      MAX_SHARE_PASSWORD_LENGTH,
      MAX_SHARE_PASSWORD_INPUT_UNITS,
      SHARE_UNLOCK_LIFETIME_MS,
      MAX_FAILED_UNLOCKS,
      UNLOCK_FAILURE_WINDOW_MS,
    }).toEqual({
      MIN_SHARE_PASSWORD_LENGTH: 8,
      MAX_SHARE_PASSWORD_LENGTH: 128,
      MAX_SHARE_PASSWORD_INPUT_UNITS: 512,
      SHARE_UNLOCK_LIFETIME_MS: 28_800_000,
      MAX_FAILED_UNLOCKS: 50,
      UNLOCK_FAILURE_WINDOW_MS: 900_000,
    });
  });
});

describe('requireSharePassword', () => {
  it('keeps the password exactly as typed, spaces included', () => {
    expect(requireSharePassword(' correct horse ')).toBe(' correct horse ');
  });

  it('counts characters, so 128 emoji fit', () => {
    const emoji = '🔑'.repeat(MAX_SHARE_PASSWORD_LENGTH);

    expect(requireSharePassword(emoji)).toBe(emoji);
  });

  it.each(['x'.repeat(7), 'x'.repeat(129)])('refuses a password of %j', (password) => {
    expect(() => requireSharePassword(password)).toThrow(InvalidShareLinkError);
    expect(() => requireSharePassword(password)).toThrow(
      'A link password has 8 to 128 characters.',
    );
  });
});

describe('generateShareUnlock and shareUnlockFromAuthorization', () => {
  it('draws a pyxis_su_ unlock and reads it back from a bearer header', () => {
    const unlock = generateShareUnlock(
      new SequenceRandomSource(Array.from({ length: 62 }, (_, index) => index)),
    );

    expect(unlock).toMatch(SHARE_UNLOCK_PATTERN);
    expect(shareUnlockFromAuthorization(`Bearer ${unlock}`)).toBe(unlock);
  });

  it.each([
    ['no header', undefined],
    ['another scheme', `Basic pyxis_su_${'a'.repeat(32)}`],
    ['a share token', `Bearer pyxis_sh_${'a'.repeat(32)}`],
    ['an access token', `Bearer pyxis_at_${'a'.repeat(32)}`],
  ])('reads nothing from %s', (_case, header) => {
    expect(shareUnlockFromAuthorization(header)).toBeNull();
  });
});

describe('shareUnlockExpiry', () => {
  it('lets an unlock live eight hours', () => {
    expect(shareUnlockExpiry(NOW)).toEqual(new Date('2026-11-05T20:00:00.000Z'));
  });
});

describe('secondsUntilUnlockable', () => {
  const since = new Date(NOW.getTime() - 5 * MINUTE_MS);

  it('locks the link at the fiftieth wrong password until its window ends', () => {
    expect(secondsUntilUnlockable({ count: MAX_FAILED_UNLOCKS, since }, NOW)).toBe(600);
  });

  it('leaves the link open one wrong password before', () => {
    expect(secondsUntilUnlockable({ count: MAX_FAILED_UNLOCKS - 1, since }, NOW)).toBeNull();
  });

  it('opens the link again when the window is over', () => {
    const old = new Date(NOW.getTime() - UNLOCK_FAILURE_WINDOW_MS);

    expect(secondsUntilUnlockable({ count: MAX_FAILED_UNLOCKS, since: old }, NOW)).toBeNull();
  });

  it('leaves a link with no failure open', () => {
    expect(secondsUntilUnlockable({ count: 0, since: null }, NOW)).toBeNull();
  });
});
