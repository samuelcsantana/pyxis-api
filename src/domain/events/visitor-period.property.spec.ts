import fc from 'fast-check';
import { PROPERTY_PARAMETERS } from '../../test-utils/property-testing';
import { todayIn } from '../queries/date-range';
import { visitorPeriodOf } from './visitor-period';

const FIRST_RECEPTION = Date.UTC(2000, 0, 1);
const LAST_RECEPTION = Date.UTC(2099, 11, 31);
const ISO_MONTH_LENGTH = 7;
const ONE_MILLISECOND = 1;
const TIME_ZONES = [
  'UTC',
  'America/Sao_Paulo',
  'Europe/Berlin',
  'Pacific/Chatham',
  'America/New_York',
  'America/St_Johns',
  'Asia/Kolkata',
  'Australia/Lord_Howe',
  'Pacific/Apia',
  'Pacific/Kiritimati',
  'Pacific/Pago_Pago',
] as const;
const SUMMER_TIME_AT_MIDNIGHT = [
  Date.UTC(2018, 10, 4, 2, 59, 59),
  Date.UTC(2018, 10, 4, 3),
  Date.UTC(2018, 1, 18, 1, 59, 59),
  Date.UTC(2018, 1, 18, 2),
  Date.UTC(2018, 1, 18, 3),
  Date.UTC(2011, 11, 30, 9, 59, 59),
  Date.UTC(2011, 11, 30, 10),
];

const timeZone = fc.constantFrom(...TIME_ZONES);
const receivedAt = fc
  .oneof(
    fc.integer({ min: FIRST_RECEPTION, max: LAST_RECEPTION }),
    fc.constantFrom(...SUMMER_TIME_AT_MIDNIGHT),
  )
  .map((epochMilliseconds) => new Date(epochMilliseconds));

function before(instant: Date): Date {
  return new Date(instant.getTime() - ONE_MILLISECOND);
}

function monthOf(isoDate: string): string {
  return isoDate.slice(0, ISO_MONTH_LENGTH);
}

describe('visitorPeriodOf, for any zone and reception time', () => {
  it("ends the day at the first instant whose local date is past the reception's", () => {
    fc.assert(
      fc.property(timeZone, receivedAt, (zone, received) => {
        const today = todayIn(zone, received);
        const { dayEndsAt } = visitorPeriodOf(zone, received);

        expect(dayEndsAt.getTime()).toBeGreaterThan(received.getTime());
        expect(todayIn(zone, dayEndsAt) > today).toBe(true);
        expect(todayIn(zone, before(dayEndsAt))).toBe(today);
      }),
      PROPERTY_PARAMETERS,
    );
  });

  it("ends the month at the first instant whose local month is past the reception's", () => {
    fc.assert(
      fc.property(timeZone, receivedAt, (zone, received) => {
        const month = monthOf(todayIn(zone, received));
        const { monthEndsAt } = visitorPeriodOf(zone, received);

        expect(monthOf(todayIn(zone, monthEndsAt)) > month).toBe(true);
        expect(monthOf(todayIn(zone, before(monthEndsAt)))).toBe(month);
      }),
      PROPERTY_PARAMETERS,
    );
  });

  it('never ends the day after the month', () => {
    fc.assert(
      fc.property(timeZone, receivedAt, (zone, received) => {
        const { dayEndsAt, monthEndsAt } = visitorPeriodOf(zone, received);

        expect(dayEndsAt.getTime()).toBeLessThanOrEqual(monthEndsAt.getTime());
      }),
      PROPERTY_PARAMETERS,
    );
  });

  it('answers the same period up to the end of the day, and the next one from it', () => {
    fc.assert(
      fc.property(timeZone, receivedAt, (zone, received) => {
        const { dayEndsAt } = visitorPeriodOf(zone, received);

        expect(visitorPeriodOf(zone, before(dayEndsAt)).dayEndsAt).toEqual(dayEndsAt);
        expect(visitorPeriodOf(zone, dayEndsAt).dayEndsAt.getTime()).toBeGreaterThan(
          dayEndsAt.getTime(),
        );
      }),
      PROPERTY_PARAMETERS,
    );
  });
});
