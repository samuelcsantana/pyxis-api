import { MAX_CITY_NAME_LENGTH, normalizeCity } from './city';
import { UNKNOWN_REGION, type ViewerRegion } from './region';

const BAHIA: ViewerRegion = { region: 'BR-BA', regionName: 'Bahia' };

describe('normalizeCity', () => {
  it('keeps the decoded city when the project turned it on and the region is known', () => {
    expect(normalizeCity(true, BAHIA, 'Feira%20de%20Santana')).toBe('Feira de Santana');
    expect(normalizeCity(true, BAHIA, 'Cama%C3%A7ari')).toBe('Camaçari');
  });

  it('keeps no city when the project has it off, whatever the header says', () => {
    expect(normalizeCity(false, BAHIA, 'Salvador')).toBeNull();
  });

  it('keeps no city without a region, as for requests from the AWS network', () => {
    expect(normalizeCity(true, UNKNOWN_REGION, 'Ashburn')).toBeNull();
  });

  it('keeps no city when none came', () => {
    expect(normalizeCity(true, BAHIA, undefined)).toBeNull();
  });

  it('keeps a name at the length limit and drops a longer or malformed one', () => {
    const atLimit = 'a'.repeat(MAX_CITY_NAME_LENGTH);

    expect(normalizeCity(true, BAHIA, atLimit)).toBe(atLimit);
    expect(normalizeCity(true, BAHIA, `${atLimit}a`)).toBeNull();
    expect(normalizeCity(true, BAHIA, 'S%C3o')).toBeNull();
  });
});
