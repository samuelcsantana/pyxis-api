import fc from 'fast-check';
import { PROPERTY_PARAMETERS } from '../../test-utils/property-testing';
import { InvalidRangeError } from '../errors/query.errors';
import { checkedRange, dayCount, MAX_RANGE_DAYS, previousRange } from './date-range';

const MILLISECONDS_PER_DAY = 86_400_000;
const FIRST_DAY = Date.UTC(1970, 0, 1) / MILLISECONDS_PER_DAY;
const LAST_DAY = Date.UTC(2099, 11, 31) / MILLISECONDS_PER_DAY;
const ISO_DATE_LENGTH = 10;
const MAX_DAYS_PAST_TODAY = 5;
const MAX_DAYS_OVER_THE_LIMIT = 20;

function isoDay(day: number): string {
  return new Date(day * MILLISECONDS_PER_DAY).toISOString().slice(0, ISO_DATE_LENGTH);
}

const firstDay = fc.integer({ min: FIRST_DAY, max: LAST_DAY });
const rangeLength = fc.integer({ min: 1, max: MAX_RANGE_DAYS });

const dateLikeText = fc.oneof(
  fc.string({ unit: 'binary' }),
  fc.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
  firstDay.map(isoDay),
);

describe('date ranges, for any dates', () => {
  it('counts the days of a range, both ends included', () => {
    fc.assert(
      fc.property(firstDay, rangeLength, (start, days) => {
        expect(dayCount({ from: isoDay(start), to: isoDay(start + days - 1) })).toBe(days);
      }),
      PROPERTY_PARAMETERS,
    );
  });

  it('compares a range with the same number of days, ending the day before it starts', () => {
    fc.assert(
      fc.property(firstDay, rangeLength, (start, days) => {
        const range = { from: isoDay(start), to: isoDay(start + days - 1) };

        expect(previousRange(range)).toEqual({
          from: isoDay(start - days),
          to: isoDay(start - 1),
        });
      }),
      PROPERTY_PARAMETERS,
    );
  });

  it('accepts a range exactly when it is in order, short enough and ends today at the latest', () => {
    fc.assert(
      fc.property(
        firstDay,
        fc.oneof(
          fc.constantFrom(0, 1, MAX_RANGE_DAYS, MAX_RANGE_DAYS + 1),
          fc.integer({ min: -MAX_RANGE_DAYS, max: MAX_RANGE_DAYS + MAX_DAYS_OVER_THE_LIMIT }),
        ),
        fc.integer({ min: -MAX_DAYS_PAST_TODAY, max: MAX_DAYS_PAST_TODAY }),
        (start, days, todayAfterEnd) => {
          const end = start + days - 1;
          const from = isoDay(start);
          const to = isoDay(end);
          const today = isoDay(end + todayAfterEnd);
          const valid = days >= 1 && days <= MAX_RANGE_DAYS && todayAfterEnd >= 0;
          const check = (): unknown => checkedRange(from, to, today);

          if (valid) {
            expect(check()).toEqual({ from, to });
          } else {
            expect(check).toThrow(InvalidRangeError);
          }
        },
      ),
      PROPERTY_PARAMETERS,
    );
  });

  it('refuses anything else only with the invalid range error', () => {
    fc.assert(
      fc.property(dateLikeText, dateLikeText, dateLikeText, (from, to, today) => {
        try {
          expect(checkedRange(from, to, today)).toEqual({ from, to });
        } catch (error) {
          expect(error).toBeInstanceOf(InvalidRangeError);
        }
      }),
      PROPERTY_PARAMETERS,
    );
  });
});
