import { isDeletionHeld } from './account-deletion-hold';

describe('isDeletionHeld', () => {
  it('tells an account whose deletion is held by the moment it was held', () => {
    expect(isDeletionHeld({ deletionHeldAt: new Date('2026-10-15T12:00:00.000Z') })).toBe(true);
  });

  it('lets the deletion of an account without that moment go ahead', () => {
    expect(isDeletionHeld({ deletionHeldAt: null })).toBe(false);
  });
});
