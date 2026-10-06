import { InvalidRangeError } from '../errors/query.errors';
import {
  checkedRange,
  dayCount,
  daysIn,
  MAX_RANGE_DAYS,
  previousRange,
  todayIn,
} from './date-range';

const SAO_PAULO = 'America/Sao_Paulo';

describe('todayIn', () => {
  it('reads the calendar day of the project, not of UTC', () => {
    const lateEveningInSaoPaulo = new Date('2026-10-06T02:30:00.000Z');

    expect(todayIn(SAO_PAULO, lateEveningInSaoPaulo)).toBe('2026-10-05');
    expect(todayIn('UTC', lateEveningInSaoPaulo)).toBe('2026-10-06');
  });

  it('moves on at local midnight', () => {
    expect(todayIn(SAO_PAULO, new Date('2026-10-06T03:30:00.000Z'))).toBe('2026-10-06');
  });
});

describe('checkedRange', () => {
  it('accepts a range that ends today', () => {
    expect(checkedRange('2026-09-06', '2026-10-05', '2026-10-05')).toEqual({
      from: '2026-09-06',
      to: '2026-10-05',
    });
  });

  it('accepts a single day', () => {
    expect(dayCount(checkedRange('2026-10-05', '2026-10-05', '2026-10-05'))).toBe(1);
  });

  it(`accepts exactly ${String(MAX_RANGE_DAYS)} days`, () => {
    expect(dayCount(checkedRange('2025-09-01', '2026-10-05', '2026-10-05'))).toBe(MAX_RANGE_DAYS);
  });

  it.each([
    ['a start after the end', '2026-10-02', '2026-10-01'],
    ['an end after today', '2026-10-01', '2026-10-06'],
    ['more than the longest range', '2025-08-31', '2026-10-05'],
    ['a day that does not exist', '2026-02-30', '2026-03-02'],
    ['a month that does not exist', '2026-13-01', '2026-10-05'],
    ['something that is not a date', 'yesterday', '2026-10-05'],
  ])('refuses %s', (_case, from, to) => {
    expect(() => checkedRange(from, to, '2026-10-05')).toThrow(InvalidRangeError);
  });
});

describe('previousRange', () => {
  it('is the same number of days right before the range', () => {
    expect(previousRange({ from: '2026-09-06', to: '2026-10-05' })).toEqual({
      from: '2026-08-07',
      to: '2026-09-05',
    });
  });

  it('is yesterday for today', () => {
    expect(previousRange({ from: '2026-03-01', to: '2026-03-01' })).toEqual({
      from: '2026-02-28',
      to: '2026-02-28',
    });
  });
});

describe('daysIn', () => {
  it('lists every day of the range, across a month end', () => {
    expect(daysIn({ from: '2026-09-29', to: '2026-10-02' })).toEqual([
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
    ]);
  });
});
