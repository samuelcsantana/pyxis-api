import { visibleText } from './visible-text';

describe('visibleText', () => {
  it.each([
    ['the null character', 'pro\u0000', 'pro'],
    ['other control characters', '\u0001pro\u007f\u0085', 'pro'],
    ['a lone surrogate', 'pro\ud800', 'pro'],
    ['a zero-width space', 'p​ro', 'pro'],
    ['tag characters that spell a hidden sentence', 'pro\u{E0049}\u{E0047}\u{E004E}', 'pro'],
    ['bidirectional overrides and isolates', '‮pro‬ ⁨x⁩', 'pro x'],
    ['a soft hyphen and a byte order mark', '﻿Infor­mation', 'Information'],
  ])('removes %s', (_label, text, visible) => {
    expect(visibleText(text)).toBe(visible);
  });

  it.each([
    ['tabs and line breaks', 'a\tb\nc\r\nd'],
    ['the joiner of an emoji sequence', '\u{1F468}‍\u{1F469}‍\u{1F467}'],
    ['the non-joiner some scripts need', 'می‌خواهم'],
    ['a surrogate pair', 'pro \u{1F680}'],
    ['plain text', 'Pro plan, 12 months'],
  ])('keeps %s', (_label, text) => {
    expect(visibleText(text)).toBe(text);
  });
});
