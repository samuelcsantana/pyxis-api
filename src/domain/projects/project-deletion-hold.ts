import type { ProjectDeletionHold } from '../repositories/project-deletion-hold.repository';

export function isProjectDeletionHeld(hold: ProjectDeletionHold | null): boolean {
  return hold !== null && hold.heldAt !== null;
}
