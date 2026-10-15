export const MAX_SUSPENSION_REASON_LENGTH = 500;

export interface SuspensionMark {
  readonly suspendedAt: Date | null;
}

export function isSuspended(account: SuspensionMark): boolean {
  return account.suspendedAt !== null;
}
