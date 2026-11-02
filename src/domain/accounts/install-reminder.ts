import type { FreeAccountActivity } from './free-account-inactivity';

const DAY_MS = 24 * 60 * 60 * 1000;

export const INSTALL_REMINDER_DAYS = 3;
export const INSTALL_REMINDER_LAST_DAY = 14;

export interface ProjectToInstall {
  readonly id: string;
  readonly name: string;
}

export interface InstallReminder {
  readonly project: ProjectToInstall | null;
}

export interface InstallReminderCandidate extends FreeAccountActivity {
  readonly inactivityNotifiedAt: Date | null;
  readonly installRemindedAt: Date | null;
}

function neverMeasuredNorTold(candidate: InstallReminderCandidate): boolean {
  return (
    candidate.lastEventAt === null &&
    candidate.inactivityNotifiedAt === null &&
    candidate.installRemindedAt === null
  );
}

function insideTheWindow(freeSince: Date, now: Date): boolean {
  const elapsed = now.getTime() - freeSince.getTime();
  return elapsed >= INSTALL_REMINDER_DAYS * DAY_MS && elapsed < INSTALL_REMINDER_LAST_DAY * DAY_MS;
}

export function installReminderDue(candidate: InstallReminderCandidate, now: Date): boolean {
  return neverMeasuredNorTold(candidate) && insideTheWindow(candidate.freeSince, now);
}
