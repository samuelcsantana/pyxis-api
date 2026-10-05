import { normalizeCountry } from './country';

describe('normalizeCountry', () => {
  it('keeps a two-letter country code', () => {
    expect(normalizeCountry('BR')).toBe('BR');
  });

  it.each([undefined, '', 'br', 'BRA', 'B1', 'XX '])('drops %j', (viewerCountry) => {
    expect(normalizeCountry(viewerCountry)).toBeNull();
  });
});
