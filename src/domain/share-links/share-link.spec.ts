import { InvalidShareLinkError } from '../errors/share-link.errors';
import { SequenceRandomSource } from '../../test-utils/sequence-random-source';
import {
  generateShareToken,
  isShareLinkOpen,
  isShareToken,
  MAX_SHARE_LINK_NAME_LENGTH,
  requireShareLinkExpiry,
  requireShareLinkName,
  SHARE_TOKEN_PATTERN,
  type ShareLink,
} from './share-link';

const NOW = new Date('2026-11-05T12:00:00.000Z');

function link(expiresAt: Date | null): ShareLink {
  return {
    id: '00000000-0000-4000-9000-000000000001',
    projectId: '00000000-0000-4000-8000-000000000001',
    name: 'Board',
    createdAt: NOW,
    expiresAt,
    passwordProtected: false,
  };
}

describe('generateShareToken', () => {
  it('draws a pyxis_sh_ token of 32 letters and digits', () => {
    const token = generateShareToken(
      new SequenceRandomSource(Array.from({ length: 62 }, (_, index) => index)),
    );

    expect(token).toMatch(SHARE_TOKEN_PATTERN);
    expect(isShareToken(token)).toBe(true);
  });
});

describe('isShareToken', () => {
  it.each([
    ['a secret key', `pyxis_sk_${'a'.repeat(32)}`],
    ['a body too short', `pyxis_sh_${'a'.repeat(31)}`],
    ['a body with a dash', `pyxis_sh_${'a'.repeat(31)}-`],
    ['nothing', ''],
  ])('refuses %s', (_case, candidate) => {
    expect(isShareToken(candidate)).toBe(false);
  });
});

describe('isShareLinkOpen', () => {
  it('keeps a link without expiry open', () => {
    expect(isShareLinkOpen(link(null), NOW)).toBe(true);
  });

  it('closes a link at the instant it expires', () => {
    expect(isShareLinkOpen(link(new Date(NOW.getTime() + 1)), NOW)).toBe(true);
    expect(isShareLinkOpen(link(NOW), NOW)).toBe(false);
  });
});

describe('requireShareLinkName', () => {
  it('trims the name', () => {
    expect(requireShareLinkName('  Board ')).toBe('Board');
  });

  it('accepts the longest name', () => {
    const longest = 'x'.repeat(MAX_SHARE_LINK_NAME_LENGTH);

    expect(requireShareLinkName(longest)).toBe(longest);
  });

  it.each([' ', 'x'.repeat(MAX_SHARE_LINK_NAME_LENGTH + 1)])('refuses %j', (name) => {
    expect(() => requireShareLinkName(name)).toThrow(InvalidShareLinkError);
  });
});

describe('requireShareLinkExpiry', () => {
  it('accepts no expiry and an expiry after now', () => {
    const later = new Date(NOW.getTime() + 1);

    expect(requireShareLinkExpiry(null, NOW)).toBeNull();
    expect(requireShareLinkExpiry(later, NOW)).toBe(later);
  });

  it('refuses an expiry that is not after now', () => {
    expect(() => requireShareLinkExpiry(NOW, NOW)).toThrow(InvalidShareLinkError);
    expect(() => requireShareLinkExpiry(NOW, NOW)).toThrow('A link can only expire after now.');
  });
});
