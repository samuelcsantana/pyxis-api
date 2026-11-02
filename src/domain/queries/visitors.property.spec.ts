import fc from 'fast-check';
import { PROPERTY_PARAMETERS } from '../../test-utils/property-testing';
import { daysIn, MAX_RANGE_DAYS } from './date-range';
import { NO_REPORT_FILTERS } from './report-filters';
import { NO_VISITOR_KINDS, type VisitorDay, visitorMonths } from './visitors';

const MILLISECONDS_PER_DAY = 86_400_000;
const FIRST_DAY = Date.UTC(2000, 0, 1) / MILLISECONDS_PER_DAY;
const LAST_DAY = Date.UTC(2099, 11, 31) / MILLISECONDS_PER_DAY;
const ISO_DATE_LENGTH = 10;
const MONTH_LENGTH = 7;
const MAX_VISITS_OF_A_KIND = 1000;

function isoDay(day: number): string {
  return new Date(day * MILLISECONDS_PER_DAY).toISOString().slice(0, ISO_DATE_LENGTH);
}

const visits = fc.integer({ min: 0, max: MAX_VISITS_OF_A_KIND });
const counts = fc.record({
  firstVisit: visits,
  firstThisMonth: visits,
  firstToday: visits,
  againToday: visits,
});
const countedRange = fc
  .tuple(fc.integer({ min: FIRST_DAY, max: LAST_DAY }), fc.integer({ min: 1, max: MAX_RANGE_DAYS }))
  .chain(([start, length]) => {
    const range = { from: isoDay(start), to: isoDay(start + length - 1) };
    return fc.array(counts, { minLength: length, maxLength: length }).map((dayCounts) => ({
      range,
      days: daysIn(range).map((date, index): VisitorDay => ({
        date,
        ...(dayCounts[index] ?? NO_VISITOR_KINDS),
      })),
    }));
  });

function total(days: readonly { firstVisit: number; firstThisMonth: number }[]) {
  return days.reduce(
    (sum, day) => ({
      firstVisit: sum.firstVisit + day.firstVisit,
      firstThisMonth: sum.firstThisMonth + day.firstThisMonth,
    }),
    { firstVisit: 0, firstThisMonth: 0 },
  );
}

describe('visitorMonths, for any range and any counts', () => {
  it('splits the days into their months without losing or doubling a visit', () => {
    fc.assert(
      fc.property(countedRange, ({ range, days }) => {
        const scope = {
          projectId: 'c1d2e3f4-a5b6-4c7d-8e9f-a0b1c2d3e4f5',
          timeZone: 'UTC',
          conversionEvent: null,
          range,
          filters: NO_REPORT_FILTERS,
        };
        const months = visitorMonths(days, scope, range.to);

        expect(total(months)).toEqual(total(days));
        expect(months.map(({ month }) => month)).toEqual(
          [...new Set(days.map(({ date }) => date.slice(0, MONTH_LENGTH)))].sort(),
        );
        expect(months.slice(1, -1).every(({ exact }) => exact)).toBe(true);
        expect(months.at(-1)?.exact).toBe(range.from <= `${range.to.slice(0, MONTH_LENGTH)}-01`);
      }),
      PROPERTY_PARAMETERS,
    );
  });
});
