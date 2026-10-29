import {
  type CityCount,
  OTHER_VALUE,
  TOP_CITIES,
  topCitiesAndRest,
  TOP_DEVICE_VALUES,
  TOP_REGIONS,
  topRegionsAndRest,
  topValuesAndOther,
} from './devices';

const count = (value: string | null, visits: number, conversions = 0) => ({
  value,
  visits,
  conversions,
  convertingVisits: Math.min(conversions, 1),
});

describe('topValuesAndOther', () => {
  it('keeps every value when there are few, sorted by visits then by name', () => {
    expect(
      topValuesAndOther([count('safari', 3, 1), count('chrome', 5), count('edge', 3)], true),
    ).toEqual([
      { value: 'chrome', visits: 5, conversions: 0, convertingVisits: 0 },
      { value: 'edge', visits: 3, conversions: 0, convertingVisits: 0 },
      { value: 'safari', visits: 3, conversions: 1, convertingVisits: 1 },
    ]);
  });

  it(`keeps the top ${String(TOP_DEVICE_VALUES)} and adds the rest up as other`, () => {
    const counts = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((value, index) =>
      count(value, 10 - index, 1),
    );

    const shares = topValuesAndOther(counts, true);

    expect(shares.map((share) => share.value)).toEqual(['a', 'b', 'c', 'd', 'e', OTHER_VALUE]);
    expect(shares.at(-1)).toEqual({
      value: OTHER_VALUE,
      visits: 5 + 4,
      conversions: 2,
      convertingVisits: 2,
    });
  });

  it('counts an unknown value, such as a missing country, as other', () => {
    expect(topValuesAndOther([count('BR', 4, 3), count(null, 2, 1)], true)).toEqual([
      { value: 'BR', visits: 4, conversions: 3, convertingVisits: 1 },
      { value: OTHER_VALUE, visits: 2, conversions: 1, convertingVisits: 1 },
    ]);
  });

  it('answers null conversions when the project counts none', () => {
    expect(topValuesAndOther([count('mobile', 4, 2)], false)).toEqual([
      { value: 'mobile', visits: 4, conversions: null, convertingVisits: null },
    ]);
  });
});

const regionCount = (region: string | null, visits: number, conversions = 0) => ({
  region,
  name: region === null ? null : `Name of ${region}`,
  visits,
  conversions,
  convertingVisits: Math.min(conversions, 1),
});

describe('topRegionsAndRest', () => {
  it('keeps every region with its name when there are few, sorted by visits then by code', () => {
    expect(
      topRegionsAndRest(
        [regionCount('BR-SP', 2, 1), regionCount('BR-BA', 5), regionCount('BR-RJ', 2)],
        true,
      ),
    ).toEqual([
      { value: 'BR-BA', name: 'Name of BR-BA', visits: 5, conversions: 0, convertingVisits: 0 },
      { value: 'BR-RJ', name: 'Name of BR-RJ', visits: 2, conversions: 0, convertingVisits: 0 },
      { value: 'BR-SP', name: 'Name of BR-SP', visits: 2, conversions: 1, convertingVisits: 1 },
    ]);
  });

  it(`keeps the top ${String(TOP_REGIONS)}, then the rest as other, then the unknown last`, () => {
    const counts = Array.from({ length: TOP_REGIONS + 2 }, (_, index) =>
      regionCount(`BR-${String(index).padStart(2, '0')}`, 20 - index, 1),
    );

    const shares = topRegionsAndRest([regionCount(null, 30, 2), ...counts], true);

    expect(shares).toHaveLength(TOP_REGIONS + 2);
    expect(shares.at(-2)).toEqual({
      value: OTHER_VALUE,
      name: null,
      visits: 20 - TOP_REGIONS + (20 - TOP_REGIONS - 1),
      conversions: 2,
      convertingVisits: 2,
    });
    expect(shares.at(-1)).toEqual({
      value: null,
      name: null,
      visits: 30,
      conversions: 2,
      convertingVisits: 1,
    });
  });

  it('adds no other and no unknown row when nothing is left over', () => {
    expect(topRegionsAndRest([regionCount('BR-SP', 1)], true).map((share) => share.value)).toEqual([
      'BR-SP',
    ]);
  });

  it('answers null conversions when the project counts none', () => {
    expect(topRegionsAndRest([regionCount(null, 4, 2)], false)).toEqual([
      { value: null, name: null, visits: 4, conversions: null, convertingVisits: null },
    ]);
  });
});

function cityCount(
  city: string | null,
  region: string | null,
  visits: number,
  conversions = 0,
): CityCount {
  return {
    city,
    region,
    regionName: region === null ? null : `Name of ${region}`,
    visits,
    conversions,
    convertingVisits: conversions,
  };
}

describe('topCitiesAndRest', () => {
  it('keeps every city with its region, sorted by visits, then by name, then by region', () => {
    expect(
      topCitiesAndRest(
        [
          cityCount('Bom Jesus', 'BR-RS', 2),
          cityCount('Salvador', 'BR-BA', 5, 1),
          cityCount('Bom Jesus', 'BR-PI', 2),
          cityCount('Aracaju', 'BR-SE', 2),
        ],
        true,
      ).map((share) => [share.value, share.region, share.visits]),
    ).toEqual([
      ['Salvador', 'BR-BA', 5],
      ['Aracaju', 'BR-SE', 2],
      ['Bom Jesus', 'BR-PI', 2],
      ['Bom Jesus', 'BR-RS', 2],
    ]);
  });

  it(`keeps the top ${String(TOP_CITIES)}, then the rest as other, then the unplaced last`, () => {
    const counts = Array.from({ length: TOP_CITIES + 2 }, (_, index) =>
      cityCount(`City ${String(index).padStart(2, '0')}`, 'BR-BA', 40 - index, 1),
    );

    const shares = topCitiesAndRest(
      [cityCount(null, 'BR-BA', 30, 2), cityCount('Ashburn', null, 3), ...counts],
      true,
    );

    expect(shares).toHaveLength(TOP_CITIES + 2);
    expect(shares[0]).toEqual({
      value: 'City 00',
      region: 'BR-BA',
      regionName: 'Name of BR-BA',
      visits: 40,
      conversions: 1,
      convertingVisits: 1,
    });
    expect(shares.at(-2)).toEqual({
      value: OTHER_VALUE,
      region: null,
      regionName: null,
      visits: 40 - TOP_CITIES + (40 - TOP_CITIES - 1),
      conversions: 2,
      convertingVisits: 2,
    });
    expect(shares.at(-1)).toEqual({
      value: null,
      region: null,
      regionName: null,
      visits: 33,
      conversions: 2,
      convertingVisits: 2,
    });
  });

  it('adds no other and no unplaced row when nothing is left over', () => {
    expect(topCitiesAndRest([cityCount('Salvador', 'BR-BA', 1)], true)).toHaveLength(1);
  });

  it('answers null conversions when the project counts none', () => {
    expect(topCitiesAndRest([cityCount('Salvador', 'BR-BA', 4, 2)], false)).toEqual([
      {
        value: 'Salvador',
        region: 'BR-BA',
        regionName: 'Name of BR-BA',
        visits: 4,
        conversions: null,
        convertingVisits: null,
      },
    ]);
  });
});
