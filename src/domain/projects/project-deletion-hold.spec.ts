import { isProjectDeletionHeld } from './project-deletion-hold';

const RELEASED = { projectId: 'p1', projectName: 'Shop', heldAt: null, reason: null };

describe('isProjectDeletionHeld', () => {
  it('is true only for a project with a hold mark', () => {
    expect(
      isProjectDeletionHeld({
        ...RELEASED,
        heldAt: new Date('2026-10-15T12:00:00.000Z'),
        reason: 'Court order',
      }),
    ).toBe(true);
    expect(isProjectDeletionHeld(RELEASED)).toBe(false);
    expect(isProjectDeletionHeld(null)).toBe(false);
  });
});
