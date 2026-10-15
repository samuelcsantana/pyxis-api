import { PROJECTLESS_GRACE_DAYS } from '../../domain/people/projectless-people';
import { FixedClock } from '../../test-utils/fixed-clock';
import { InMemoryProjectlessPeopleRepository } from '../../test-utils/in-memory-projectless-people.repository';
import { SweepProjectlessPeopleUseCase } from './sweep-projectless-people.usecase';

const NOW = new Date('2026-12-01T03:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * DAY_MS);
}

function setup() {
  const people = new InMemoryProjectlessPeopleRepository();
  const useCase = new SweepProjectlessPeopleUseCase(people, new FixedClock(NOW));
  return { people, useCase };
}

describe('SweepProjectlessPeopleUseCase', () => {
  it('marks a person with no project and no account, and keeps everyone else unmarked', async () => {
    const { people, useCase } = setup();
    people.add({ adminUserId: 'left-alone' });
    people.add({ adminUserId: 'reader', hasAccess: true });
    people.add({ adminUserId: 'owner', ownsAccount: true });

    await expect(useCase.execute()).resolves.toEqual({
      projectlessMarked: 1,
      projectlessRemoved: 0,
    });
    expect(people.person('left-alone')?.projectlessSince).toEqual(NOW);
    expect(people.person('reader')?.projectlessSince).toBeNull();
    expect(people.person('owner')?.projectlessSince).toBeNull();
  });

  it('keeps the first mark, so the thirty days count from the day the person was left alone', async () => {
    const { people, useCase } = setup();
    people.add({ adminUserId: 'left-alone', projectlessSince: daysAgo(10) });

    await expect(useCase.execute()).resolves.toEqual({
      projectlessMarked: 0,
      projectlessRemoved: 0,
    });
    expect(people.person('left-alone')?.projectlessSince).toEqual(daysAgo(10));
  });

  it('deletes a person marked thirty days ago and still alone, not one marked a day later', async () => {
    const { people, useCase } = setup();
    people.add({ adminUserId: 'due', projectlessSince: daysAgo(PROJECTLESS_GRACE_DAYS) });
    people.add({ adminUserId: 'not-yet', projectlessSince: daysAgo(PROJECTLESS_GRACE_DAYS - 1) });

    await expect(useCase.execute()).resolves.toEqual({
      projectlessMarked: 0,
      projectlessRemoved: 1,
    });
    expect(people.person('due')).toBeUndefined();
    expect(people.person('not-yet')).toBeDefined();
  });

  it('clears the mark of a person who got a project or an account back, and deletes neither', async () => {
    const { people, useCase } = setup();
    people.add({
      adminUserId: 'invited-again',
      hasAccess: true,
      projectlessSince: daysAgo(PROJECTLESS_GRACE_DAYS + 5),
    });
    people.add({
      adminUserId: 'signed-up',
      ownsAccount: true,
      projectlessSince: daysAgo(PROJECTLESS_GRACE_DAYS + 5),
    });

    await expect(useCase.execute()).resolves.toEqual({
      projectlessMarked: 0,
      projectlessRemoved: 0,
    });
    expect(people.person('invited-again')?.projectlessSince).toBeNull();
    expect(people.person('signed-up')?.projectlessSince).toBeNull();
  });
});
