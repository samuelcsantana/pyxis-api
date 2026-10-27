import {
  inactivityDeletionDueAt,
  inactivityOf,
  storedAnEventSince,
} from './free-account-inactivity';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2027-03-01T06:00:00.000Z');

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * DAY_MS);
}

describe('inactivityOf', () => {
  it('finds an account that stored no event 30 days after entering the free plan, not 29', () => {
    expect(inactivityOf({ freeSince: daysAgo(30), lastEventAt: null }, NOW)).toBe('empty');
    expect(inactivityOf({ freeSince: daysAgo(29), lastEventAt: null }, NOW)).toBeNull();
  });

  it('finds an account with no event for 90 days, not 89', () => {
    expect(inactivityOf({ freeSince: daysAgo(200), lastEventAt: daysAgo(90) }, NOW)).toBe('idle');
    expect(inactivityOf({ freeSince: daysAgo(200), lastEventAt: daysAgo(89) }, NOW)).toBeNull();
  });

  it('counts the 90 days from the day the account came back to free, after a quiet paid period', () => {
    expect(inactivityOf({ freeSince: daysAgo(10), lastEventAt: daysAgo(100) }, NOW)).toBeNull();
    expect(inactivityOf({ freeSince: daysAgo(90), lastEventAt: daysAgo(300) }, NOW)).toBe('idle');
  });
});

describe('inactivityDeletionDueAt', () => {
  it('comes seven days after the notice', () => {
    expect(inactivityDeletionDueAt(NOW)).toEqual(new Date('2027-03-08T06:00:00.000Z'));
  });
});

describe('storedAnEventSince', () => {
  it('tells an event stored after the notice from one before it or none', () => {
    const notifiedAt = daysAgo(3);

    expect(storedAnEventSince(daysAgo(2), notifiedAt)).toBe(true);
    expect(storedAnEventSince(notifiedAt, notifiedAt)).toBe(false);
    expect(storedAnEventSince(daysAgo(40), notifiedAt)).toBe(false);
    expect(storedAnEventSince(null, notifiedAt)).toBe(false);
  });
});
