import { z } from 'zod';
import { seededRandom } from './seeded-random';

const SAMPLES = 2000;

describe('seededRandom', () => {
  it('draws the same sequence for the same seed and another for another seed', () => {
    const first = seededRandom('demo:2026-10-19');
    const again = seededRandom('demo:2026-10-19');
    const other = seededRandom('demo:2026-10-20');

    const draws = Array.from({ length: 5 }, () => first.next());

    expect(Array.from({ length: 5 }, () => again.next())).toEqual(draws);
    expect(Array.from({ length: 5 }, () => other.next())).not.toEqual(draws);
    expect(draws.every((draw) => draw >= 0 && draw < 1)).toBe(true);
  });

  it('keeps whole numbers inside both bounds and reaches each of them', () => {
    const random = seededRandom('integers');

    const values = new Set(Array.from({ length: SAMPLES }, () => random.integer(2, 5)));

    expect([...values].sort()).toEqual([2, 3, 4, 5]);
  });

  it('answers a chance of zero never and a chance of one always', () => {
    const random = seededRandom('chances');

    expect(Array.from({ length: 100 }, () => random.chance(0)).some(Boolean)).toBe(false);
    expect(Array.from({ length: 100 }, () => random.chance(1)).every(Boolean)).toBe(true);
  });

  it('picks by weight, never an item that weighs nothing', () => {
    const random = seededRandom('weights');

    const picks = Array.from({ length: SAMPLES }, () =>
      random.weighted([
        { item: 'often', weight: 9 },
        { item: 'never', weight: 0 },
        { item: 'rarely', weight: 1 },
      ]),
    );

    expect(picks).not.toContain('never');
    expect(picks.filter((pick) => pick === 'often').length).toBeGreaterThan(
      picks.filter((pick) => pick === 'rarely').length * 5,
    );
  });

  it('refuses to pick from nothing', () => {
    const random = seededRandom('empty');

    expect(() => random.pick([])).toThrow('Nothing to pick from.');
    expect(() => random.weighted([])).toThrow('Nothing to pick from.');
  });

  it('writes ids that are version 4 UUIDs, all different', () => {
    const random = seededRandom('ids');

    const ids = Array.from({ length: SAMPLES }, () => random.uuid());

    expect(ids.every((id) => z.uuid({ version: 'v4' }).safeParse(id).success)).toBe(true);
    expect(new Set(ids).size).toBe(SAMPLES);
  });
});
