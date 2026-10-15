import { isSuspended } from './account-suspension';

describe('isSuspended', () => {
  it('tells a suspended account by the moment it was suspended', () => {
    expect(isSuspended({ suspendedAt: new Date('2026-10-15T12:00:00.000Z') })).toBe(true);
  });

  it('leaves an account without that moment running', () => {
    expect(isSuspended({ suspendedAt: null })).toBe(false);
  });
});
