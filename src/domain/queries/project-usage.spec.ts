import { InvalidUsageMonthError } from '../errors/query.errors';
import { monthLabelOf, usageMonth } from './project-usage';

describe('usageMonth', () => {
  it('spans the calendar month in UTC, the start included and the next month excluded', () => {
    expect(usageMonth('2026-11')).toEqual({
      from: new Date('2026-11-01T00:00:00.000Z'),
      to: new Date('2026-12-01T00:00:00.000Z'),
    });
  });

  it('ends December at the first day of the next year', () => {
    expect(usageMonth('2026-12').to).toEqual(new Date('2027-01-01T00:00:00.000Z'));
  });

  it.each(['2026-13', '2026-00', '2026-1', '26-11', 'november', '2026-11-01', ''])(
    'refuses %j',
    (label) => {
      expect(() => usageMonth(label)).toThrow(InvalidUsageMonthError);
    },
  );
});

describe('monthLabelOf', () => {
  it('names the month of a moment in UTC', () => {
    expect(monthLabelOf(new Date('2026-10-14T15:00:00.000Z'))).toBe('2026-10');
  });

  it('keeps the last minutes of a month in that month, whatever the local time zone', () => {
    expect(monthLabelOf(new Date('2026-10-31T23:59:59.999Z'))).toBe('2026-10');
    expect(monthLabelOf(new Date('2026-11-01T00:00:00.000Z'))).toBe('2026-11');
  });
});
