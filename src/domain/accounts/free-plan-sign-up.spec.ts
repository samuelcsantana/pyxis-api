import type { Account } from '../entities/account.entity';
import { canTakeAFreePlace, freePlanStateOf } from './free-plan-sign-up';

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
