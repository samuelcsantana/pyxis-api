import fc from 'fast-check';
import { PROPERTY_PARAMETERS } from '../../test-utils/property-testing';
import {
  INSTALL_REMINDER_DAYS,
  INSTALL_REMINDER_LAST_DAY,
  type InstallReminderCandidate,
  installReminderDue,
} from './install-reminder';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-05T06:00:00.000Z');
const FIRST_DUE_MS = INSTALL_REMINDER_DAYS * DAY_MS;
const FIRST_LATE_MS = INSTALL_REMINDER_LAST_DAY * DAY_MS;
const GENERATED_SPAN_MS = 20 * DAY_MS;

function freeFor(
  elapsedMs: number,
  fields: Partial<InstallReminderCandidate> = {},
): InstallReminderCandidate {
  return {
    freeSince: new Date(NOW.getTime() - elapsedMs),
    lastEventAt: null,
    inactivityNotifiedAt: null,
    installRemindedAt: null,
    ...fields,
  };
}

const elapsed = fc.oneof(
  fc.constantFrom(FIRST_DUE_MS - 1, FIRST_DUE_MS, FIRST_LATE_MS - 1, FIRST_LATE_MS),
  fc.integer({ min: -DAY_MS, max: GENERATED_SPAN_MS }),
);
const someMoment = fc.date({ noInvalidDate: true });

describe('installReminderDue', () => {
  it('is due from three days after the account entered the free plan, not before', () => {
    expect(installReminderDue(freeFor(FIRST_DUE_MS), NOW)).toBe(true);
    expect(installReminderDue(freeFor(FIRST_DUE_MS - 1), NOW)).toBe(false);
    expect(installReminderDue(freeFor(2 * DAY_MS), NOW)).toBe(false);
  });

  it('is no longer due on the fourteenth day, so a late run never reminds an old account', () => {
    expect(installReminderDue(freeFor(FIRST_LATE_MS - 1), NOW)).toBe(true);
    expect(installReminderDue(freeFor(FIRST_LATE_MS), NOW)).toBe(false);
  });

  it('is not due for an account that stored an event, got the inactivity notice or was reminded', () => {
    const inWindow = FIRST_DUE_MS;

    expect(installReminderDue(freeFor(inWindow, { lastEventAt: NOW }), NOW)).toBe(false);
    expect(installReminderDue(freeFor(inWindow, { inactivityNotifiedAt: NOW }), NOW)).toBe(false);
    expect(installReminderDue(freeFor(inWindow, { installRemindedAt: NOW }), NOW)).toBe(false);
  });

  it('is due exactly inside the window, for any time on the free plan', () => {
    fc.assert(
      fc.property(elapsed, (elapsedMs) => {
        const inside = elapsedMs >= FIRST_DUE_MS && elapsedMs < FIRST_LATE_MS;
        expect(installReminderDue(freeFor(elapsedMs), NOW)).toBe(inside);
      }),
      PROPERTY_PARAMETERS,
    );
  });

  it('is never due once an event, a notice or a reminder exists, whatever the time', () => {
    const marked = fc.oneof(
      someMoment.map((lastEventAt) => ({ lastEventAt })),
      someMoment.map((inactivityNotifiedAt) => ({ inactivityNotifiedAt })),
      someMoment.map((installRemindedAt) => ({ installRemindedAt })),
    );
    fc.assert(
      fc.property(elapsed, marked, (elapsedMs, fields) => {
        expect(installReminderDue(freeFor(elapsedMs, fields), NOW)).toBe(false);
      }),
      PROPERTY_PARAMETERS,
    );
  });
});
