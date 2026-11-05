import type { Goal } from '../goals/goal';
import { conversionRate, goalsSummary } from './goals-summary';

const CREATED_AT = new Date('2026-11-04T12:00:00.000Z');
const SIGNUP: Goal = {
  id: 'a',
  projectId: 'project-1',
  name: 'Signed up',
  target: { type: 'event', name: 'signup_completed' },
  position: 1,
  createdAt: CREATED_AT,
};
const THANKS: Goal = { ...SIGNUP, id: 'b', name: 'Thanks', target: { type: 'page', path: '/t' } };

describe('conversionRate', () => {
  it('divides the converting visits by the visits', () => {
    expect(conversionRate(5, 20)).toBe(0.25);
  });

  it('has no rate without visits', () => {
    expect(conversionRate(0, 0)).toBeNull();
  });
});

describe('goalsSummary', () => {
  it('pairs each goal with its counts in order and rates it against the visits', () => {
    expect(
      goalsSummary([SIGNUP, THANKS], { visits: 40, conversions: [6, 3], convertingVisits: [4, 2] }),
    ).toEqual({
      visits: 40,
      goals: [
        { goal: SIGNUP, conversions: 6, convertingVisits: 4, conversionRate: 0.1 },
        { goal: THANKS, conversions: 3, convertingVisits: 2, conversionRate: 0.05 },
      ],
    });
  });

  it('counts zero for a goal the counts do not reach', () => {
    expect(
      goalsSummary([SIGNUP], { visits: 0, conversions: [], convertingVisits: [] }).goals,
    ).toEqual([{ goal: SIGNUP, conversions: 0, convertingVisits: 0, conversionRate: null }]);
  });
});
