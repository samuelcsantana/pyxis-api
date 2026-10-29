import type { Account } from '../entities/account.entity';
import {
  canTakeAFreePlace,
  freePlaceOf,
  freePlacementOf,
  freePlanStateOf,
} from './free-plan-sign-up';

const WAITING_SINCE = new Date('2026-11-01T10:00:00.000Z');

function accountWith(changes: Partial<Account>): Account {
  return { status: 'incomplete', freeWaitlistedAt: null, ...changes } as Account;
}

describe('freePlacementOf', () => {
  it('places a claim below the maximum of free accounts, and makes it wait at the maximum', () => {
    const seat = { freeAccountsMax: 200, mailboxHoldsAFreePlace: false };

    expect(freePlacementOf({ ...seat, freeAccounts: 199 })).toBe('place');
    expect(freePlacementOf({ ...seat, freeAccounts: 200 })).toBe('waitlist');
  });

  it('refuses a mailbox that already holds a free place, whether places are left or not', () => {
    const seat = { freeAccountsMax: 200, mailboxHoldsAFreePlace: true };

    expect(freePlacementOf({ ...seat, freeAccounts: 0 })).toBe('refuse');
    expect(freePlacementOf({ ...seat, freeAccounts: 200 })).toBe('refuse');
  });
});

describe('freePlaceOf', () => {
  it('says placed for an account on the free plan', () => {
    expect(freePlaceOf(accountWith({ status: 'free' }), 'place')).toBe('placed');
  });

  it('says waitlisted for an unfinished account marked as waiting', () => {
    expect(freePlaceOf(accountWith({ freeWaitlistedAt: WAITING_SINCE }), 'waitlist')).toBe(
      'waitlisted',
    );
  });

  it('says taken by the same mailbox for an unfinished account refused a place', () => {
    expect(freePlaceOf(accountWith({}), 'refuse')).toBe('taken_by_same_mailbox');
  });

  it('says not offered for an unfinished account that claimed nothing', () => {
    expect(freePlaceOf(accountWith({}), null)).toBe('not_offered');
  });

  it('says not offered for an account that runs on another plan, whatever the claim', () => {
    expect(freePlaceOf(accountWith({ status: 'active' }), 'place')).toBe('not_offered');
  });
});

const OPEN = { open: true, freePlanOpen: true, freeAccountsMax: 200 };

describe('freePlanStateOf', () => {
  it('is open below the maximum of free accounts, and full at it', () => {
    expect(freePlanStateOf(OPEN, 199)).toBe('open');
    expect(freePlanStateOf(OPEN, 200)).toBe('full');
  });

  it('is closed while sign-up or the free plan switch is off', () => {
    expect(freePlanStateOf({ ...OPEN, open: false }, 0)).toBe('closed');
    expect(freePlanStateOf({ ...OPEN, freePlanOpen: false }, 0)).toBe('closed');
  });
});

describe('canTakeAFreePlace', () => {
  it.each([
    ['incomplete', true],
    ['free', false],
    ['trialing', false],
    ['active', false],
    ['past_due', false],
    ['ending', false],
    ['ended', false],
    ['comped', false],
  ] as const)('a %s account can take a free place: %s', (status, takes) => {
    expect(canTakeAFreePlace({ status } as Account)).toBe(takes);
  });
});
