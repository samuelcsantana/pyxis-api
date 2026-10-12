import { MAX_REGION_NAME_LENGTH, normalizeRegion, UNKNOWN_REGION } from './region';

describe('normalizeRegion', () => {
  it('keeps the subdivision behind its country and decodes the percent-encoded name', () => {
    expect(normalizeRegion('BR', 'SP', 'S%C3%A3o%20Paulo')).toEqual({
      region: 'BR-SP',
      regionName: 'São Paulo',
    });
  });

  it('keeps a plain name as it came', () => {
    expect(normalizeRegion('US', 'CA', 'California')).toEqual({
      region: 'US-CA',
      regionName: 'California',
    });
  });

  it('accepts subdivisions made of digits', () => {
    expect(normalizeRegion('JP', '13', 'Tokyo').region).toBe('JP-13');
  });

  it('keeps no region when the country is unknown', () => {
    expect(normalizeRegion(null, 'SP', 'S%C3%A3o%20Paulo')).toBe(UNKNOWN_REGION);
  });

  it.each([undefined, '', 'sp', 'ABCD', 'S P', 'S-P'])(
    'keeps no region for the subdivision %j',
    (viewerRegion) => {
      expect(normalizeRegion('BR', viewerRegion, 'S%C3%A3o%20Paulo')).toBe(UNKNOWN_REGION);
    },
  );

  it('keeps the region without a name when no name came', () => {
    expect(normalizeRegion('BR', 'SP', undefined)).toEqual({ region: 'BR-SP', regionName: null });
  });

  it('trims the name', () => {
    expect(normalizeRegion('BR', 'BA', '%20Bahia%20').regionName).toBe('Bahia');
  });

  it('keeps a name at the length limit', () => {
    const name = 'a'.repeat(MAX_REGION_NAME_LENGTH);

    expect(normalizeRegion('BR', 'SP', name).regionName).toBe(name);
  });

  it.each([
    ['a stray percent sign', '100%'],
    ['an escape that is not hexadecimal', '%ZZ'],
    ['an incomplete UTF-8 sequence', 'S%C3o'],
    ['the replacement character', '%EF%BF%BD'],
    ['a character outside printable ASCII', 'São'],
    ['an encoded line break', 'S%0AP'],
    ['nothing but spaces', '%20%20'],
    ['more characters than the limit', 'a'.repeat(MAX_REGION_NAME_LENGTH + 1)],
  ])('keeps the region but drops a name with %s', (_case, viewerRegionName) => {
    expect(normalizeRegion('BR', 'SP', viewerRegionName)).toEqual({
      region: 'BR-SP',
      regionName: null,
    });
  });
});
