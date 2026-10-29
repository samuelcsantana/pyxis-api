export const CONTINENTS = ['africa', 'americas', 'asia', 'europe', 'oceania'] as const;

export type Continent = (typeof CONTINENTS)[number];

const COUNTRIES_BY_CONTINENT: Readonly<Record<Continent, string>> = {
  africa: `
    DZ EG LY MA SD TN EH IO BI KM DJ ER ET TF KE MG MW MU YT MZ RE RW SC SO SS UG TZ ZM ZW AO
    CM CF TD CG CD GQ GA ST BW SZ LS NA ZA BJ BF CV CI GM GH GN GW LR ML MR NE NG SH SN SL TG`,
  americas: `
    AI AG AW BS BB BQ VG KY CU CW DM DO GD GP HT JM MQ MS PR BL KN LC MF VC SX TT TC VI BZ CR
    SV GT HN MX NI PA AR BO BV BR CL CO EC FK GF GY PY PE GS SR UY VE BM CA GL PM US`,
  asia: `
    KZ KG TJ TM UZ CN HK MO KP JP MN KR TW BN KH ID LA MY MM PH SG TH TL VN AF BD BT IN IR MV
    NP PK LK AM AZ BH CY GE IQ IL JO KW LB OM QA SA PS SY TR AE YE`,
  europe: `
    BY BG CZ HU PL MD RO RU SK UA AX DK EE FO FI GG IS IE IM LV LT NO SJ SE GB JE AL AD BA HR
    GI GR VA IT MT ME MK PT SM RS SI ES AT BE FR DE LI LU MC NL CH`,
  oceania: `
    AU CX CC HM NZ NF FJ NC PG SB VU GU KI MH FM NR MP PW UM AS CK PF NU PN WS TK TO TV WF`,
};

const WHITESPACE = /\s+/;

const CONTINENT_OF_COUNTRY: ReadonlyMap<string, Continent> = new Map(
  CONTINENTS.flatMap((continent) =>
    COUNTRIES_BY_CONTINENT[continent]
      .trim()
      .split(WHITESPACE)
      .map((country) => [country, continent] as const),
  ),
);

export function continentOf(country: string): Continent | null {
  return CONTINENT_OF_COUNTRY.get(country) ?? null;
}

export function continentCount(countries: readonly string[]): number {
  return new Set(
    countries.map(continentOf).filter((continent): continent is Continent => continent !== null),
  ).size;
}
