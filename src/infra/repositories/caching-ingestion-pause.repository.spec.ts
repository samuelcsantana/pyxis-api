import type { IngestionPauseRepository } from '../../domain/repositories/ingestion-pause.repository';
import { FixedClock } from '../../test-utils/fixed-clock';
import {
  CachingIngestionPauseRepository,
  INGESTION_PAUSE_CACHE_TTL_MS,
} from './drizzle-ingestion-pause.repository';

const PROJECT_ID = 'a3f1c2d4-5b6e-4f70-8192-a3b4c5d6e7f8';
const RESUMES_AT = new Date('2026-11-01T00:00:00.000Z');

function setup(answer: Date | null) {
  const lookups: string[] = [];
  const delegate: IngestionPauseRepository = {
    pausedUntil: (projectId) => {
      lookups.push(projectId);
      return Promise.resolve(answer);
    },
  };
  const clock = new FixedClock(new Date('2026-10-14T14:00:00.000Z'));
  return { repository: new CachingIngestionPauseRepository(delegate, clock), lookups, clock };
}

describe('CachingIngestionPauseRepository', () => {
  it('answers a pause from memory for 60 seconds, then asks again', async () => {
    const { repository, lookups, clock } = setup(RESUMES_AT);

    await repository.pausedUntil(PROJECT_ID);
    clock.advanceBy(INGESTION_PAUSE_CACHE_TTL_MS - 1);
    expect(await repository.pausedUntil(PROJECT_ID)).toBe(RESUMES_AT);
    clock.advanceBy(1);
    await repository.pausedUntil(PROJECT_ID);

    expect(lookups).toEqual([PROJECT_ID, PROJECT_ID]);
  });

  it('remembers that a project is not paused too, since only resolved projects reach it', async () => {
    const { repository, lookups } = setup(null);

    expect(await repository.pausedUntil(PROJECT_ID)).toBeNull();
    expect(await repository.pausedUntil(PROJECT_ID)).toBeNull();

    expect(lookups).toEqual([PROJECT_ID]);
  });
});
