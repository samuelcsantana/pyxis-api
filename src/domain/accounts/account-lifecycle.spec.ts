import {
  deletionDueAt,
  deletionThreshold,
  incompleteThreshold,
  reminderThreshold,
  withdrawalWindowStart,
} from './account-lifecycle';

const NOW = new Date('2026-12-01T03:00:00.000Z');

describe('the end of an account', () => {
  it('deletes an account thirty days after its access ended', () => {
    expect(deletionDueAt(new Date('2026-11-01T03:00:00.000Z'))).toEqual(NOW);
    expect(deletionThreshold(NOW)).toEqual(new Date('2026-11-01T03:00:00.000Z'));
  });

  it('reminds the owner seven days before the deletion', () => {
    expect(reminderThreshold(NOW)).toEqual(new Date('2026-11-08T03:00:00.000Z'));
  });

  it('removes an account that never subscribed after seven days', () => {
    expect(incompleteThreshold(NOW)).toEqual(new Date('2026-11-24T03:00:00.000Z'));
  });
});

describe('the right of withdrawal', () => {
  it('refunds a first payment made in the last seven days', () => {
    expect(withdrawalWindowStart(NOW)).toEqual(new Date('2026-11-24T03:00:00.000Z'));
  });
});
