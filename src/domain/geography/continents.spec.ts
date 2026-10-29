import { type Continent, continentCount, continentOf } from './continents';

const ISO_3166_1_CODES = `
  AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ
  BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM
  DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS
  GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN
  KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ
  MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM
  PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV
  SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI
  VN VU WF WS YE YT ZA ZM ZW
`
  .trim()
  .split(/\s+/);

const CODES_WITHOUT_A_CONTINENT = ['AQ'];

describe('continentOf', () => {
  it('knows the 249 ISO 3166-1 codes', () => {
    expect(new Set(ISO_3166_1_CODES).size).toBe(249);
  });

  it('places every ISO 3166-1 country in one of the five UN M49 continents, Antarctica apart', () => {
    const unplaced = ISO_3166_1_CODES.filter((code) => continentOf(code) === null);

    expect(unplaced).toEqual(CODES_WITHOUT_A_CONTINENT);
  });

  it('splits the countries the way UN M49 does', () => {
    const perContinent = new Map<Continent, number>();
    for (const code of ISO_3166_1_CODES) {
      const continent = continentOf(code);
      if (continent !== null) {
        perContinent.set(continent, (perContinent.get(continent) ?? 0) + 1);
      }
    }

    expect(Object.fromEntries(perContinent)).toEqual({
      africa: 60,
      americas: 57,
      asia: 51,
      europe: 51,
      oceania: 29,
    });
  });

  it.each([
    ['BR', 'americas'],
    ['US', 'americas'],
    ['PT', 'europe'],
    ['TR', 'asia'],
    ['EG', 'africa'],
    ['TW', 'asia'],
    ['AU', 'oceania'],
  ])('places %s in %s', (country, continent) => {
    expect(continentOf(country)).toBe(continent);
  });

  it('places no code it does not know', () => {
    expect(continentOf('ZZ')).toBeNull();
  });
});

describe('continentCount', () => {
  it('counts each continent once and leaves out the codes without one', () => {
    expect(continentCount(['BR', 'US', 'CA', 'DE', 'IE', 'NL', 'EG', 'TW', 'AQ', 'ZZ'])).toBe(4);
    expect(continentCount(['BR', 'DE', 'EG', 'TW', 'AU'])).toBe(5);
  });

  it('counts none for no country', () => {
    expect(continentCount([])).toBe(0);
  });
});
