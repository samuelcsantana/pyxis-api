export const MAX_DELETION_HOLD_REASON_LENGTH = 500;

export interface DeletionHoldMark {
  readonly deletionHeldAt: Date | null;
}

export function isDeletionHeld(account: DeletionHoldMark): boolean {
  return account.deletionHeldAt !== null;
}
