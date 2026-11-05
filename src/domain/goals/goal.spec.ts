import { GoalNotFoundError, InvalidGoalError } from '../errors/goal.errors';
import {
  conversionTarget,
  type Goal,
  goalWithId,
  inGoalOrder,
  requireGoalName,
  requireGoalTarget,
} from './goal';

const CREATED_AT = new Date('2026-11-04T12:00:00.000Z');

function goal(id: string, position: number, target: Goal['target']): Goal {
  return {
    id,
    projectId: 'project-1',
    name: `Goal ${id}`,
    target,
    position,
    createdAt: CREATED_AT,
  };
}

const SIGNUP = goal('a', 1, { type: 'event', name: 'signup_completed' });
const THANKS = goal('b', 3, { type: 'page', path: '/thanks/*' });

describe('requireGoalName', () => {
  it('trims the name', () => {
    expect(requireGoalName('  Signed up  ')).toBe('Signed up');
  });

  it.each([
    ['empty', '   '],
    ['longer than 64 characters', 'x'.repeat(65)],
  ])('refuses a name %s', (_case, name) => {
    expect(() => requireGoalName(name)).toThrow(InvalidGoalError);
  });
});

describe('requireGoalTarget', () => {
  it('accepts an event name and a page pattern, keeping only their fields', () => {
    expect(requireGoalTarget({ type: 'event', name: 'purchase' })).toEqual({
      type: 'event',
      name: 'purchase',
    });
    expect(requireGoalTarget({ type: 'page', path: '/orders/*/done' })).toEqual({
      type: 'page',
      path: '/orders/*/done',
    });
  });

  it.each([
    ['an event name with a hyphen', { type: 'event', name: 'sign-up' } as const, 'event'],
    ['a page path without its slash', { type: 'page', path: 'thanks' } as const, 'path'],
    [
      'a page path of 257 characters',
      { type: 'page', path: `/${'a'.repeat(256)}` } as const,
      'path',
    ],
  ])('refuses %s', (_case, target, field) => {
    const refusal = (() => {
      try {
        requireGoalTarget(target);
        return null;
      } catch (error) {
        return error;
      }
    })();

    expect(refusal).toBeInstanceOf(InvalidGoalError);
    expect(refusal).toMatchObject({ field });
  });
});

describe('inGoalOrder', () => {
  it('orders goals by position without changing the list given', () => {
    const given = [THANKS, SIGNUP];

    expect(inGoalOrder(given)).toEqual([SIGNUP, THANKS]);
    expect(given).toEqual([THANKS, SIGNUP]);
  });
});

describe('goalWithId', () => {
  it('finds the goal with the id', () => {
    expect(goalWithId([SIGNUP, THANKS], 'b')).toBe(THANKS);
  });

  it('answers goal_not_found for an id of no goal', () => {
    expect(() => goalWithId([SIGNUP], 'b')).toThrow(GoalNotFoundError);
  });
});

describe('conversionTarget', () => {
  it('counts the goal asked for', () => {
    expect(conversionTarget([SIGNUP, THANKS], 'b')).toEqual(THANKS.target);
  });

  it('counts the first goal when none is asked for', () => {
    expect(conversionTarget([THANKS, SIGNUP], undefined)).toEqual(SIGNUP.target);
  });

  it('counts nothing for a project without goals', () => {
    expect(conversionTarget([], undefined)).toBeNull();
  });

  it('answers goal_not_found for an id that is not one of the goals', () => {
    expect(() => conversionTarget([], 'a')).toThrow(GoalNotFoundError);
  });
});
