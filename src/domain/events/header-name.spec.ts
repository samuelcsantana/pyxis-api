import { decodeHeaderName } from './header-name';

const MAX_LENGTH = 12;

describe('decodeHeaderName', () => {
  it('decodes a percent-encoded UTF-8 name', () => {
    expect(decodeHeaderName('S%C3%A3o%20Paulo', MAX_LENGTH)).toBe('São Paulo');
  });

  it('keeps a plain name as it came', () => {
    expect(decodeHeaderName('Seattle', MAX_LENGTH)).toBe('Seattle');
  });

  it('trims the name', () => {
    expect(decodeHeaderName('%20Bahia%20', MAX_LENGTH)).toBe('Bahia');
  });

  it('keeps a name at the length limit', () => {
    const name = 'a'.repeat(MAX_LENGTH);

    expect(decodeHeaderName(name, MAX_LENGTH)).toBe(name);
  });

  it.each([
    ['a stray percent sign', '100%'],
    ['an escape that is not hexadecimal', '%ZZ'],
    ['an incomplete UTF-8 sequence', 'S%C3o'],
    ['the replacement character', '%EF%BF%BD'],
    ['a character outside printable ASCII', 'São'],
    ['an encoded line break', 'S%0AP'],
    ['nothing but spaces', '%20%20'],
    ['more characters than the limit', 'a'.repeat(MAX_LENGTH + 1)],
  ])('drops a name with %s', (_case, encoded) => {
    expect(decodeHeaderName(encoded, MAX_LENGTH)).toBeNull();
  });
});
