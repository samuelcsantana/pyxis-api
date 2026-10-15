import {
  type ProjectAccountState,
  type ProjectAccountStateRepository,
  UNRESTRICTED_PROJECT,
} from '../../domain/repositories/project-account-state.repository';
import { FixedClock } from '../../test-utils/fixed-clock';
import {
  CachingProjectAccountStateRepository,
  PROJECT_ACCOUNT_STATE_CACHE_TTL_MS,
} from './drizzle-project-account-state.repository';

const PROJECT_ID = 'a3f1c2d4-5b6e-4f70-8192-a3b4c5d6e7f8';
const PAUSED: ProjectAccountState = {
  ingestionPausedUntil: new Date('2026-11-01T00:00:00.000Z'),
  suspended: false,
  ingestionSuspended: false,
};

function setup(answer: ProjectAccountState) {
  const lookups: string[] = [];
  const delegate: ProjectAccountStateRepository = {
    stateOf: (projectId) => {
      lookups.push(projectId);
      return Promise.resolve(answer);
    },
  };
  const clock = new FixedClock(new Date('2026-10-14T14:00:00.000Z'));
  return {
    repository: new CachingProjectAccountStateRepository(delegate, clock),
    lookups,
    clock,
  };
}

describe('CachingProjectAccountStateRepository', () => {
  it("answers a project's account state from memory for 60 seconds, then asks again", async () => {
    const { repository, lookups, clock } = setup(PAUSED);

    await repository.stateOf(PROJECT_ID);
    clock.advanceBy(PROJECT_ACCOUNT_STATE_CACHE_TTL_MS - 1);
    expect(await repository.stateOf(PROJECT_ID)).toBe(PAUSED);
    clock.advanceBy(1);
    await repository.stateOf(PROJECT_ID);

    expect(lookups).toEqual([PROJECT_ID, PROJECT_ID]);
  });

  it('remembers that a project runs freely too, since only resolved projects reach it', async () => {
    const { repository, lookups } = setup(UNRESTRICTED_PROJECT);

    expect(await repository.stateOf(PROJECT_ID)).toBe(UNRESTRICTED_PROJECT);
    expect(await repository.stateOf(PROJECT_ID)).toBe(UNRESTRICTED_PROJECT);

    expect(lookups).toEqual([PROJECT_ID]);
  });
});
