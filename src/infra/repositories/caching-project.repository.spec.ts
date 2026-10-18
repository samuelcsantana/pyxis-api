import type { Project } from '../../domain/entities/project.entity';
import type { ProjectRepository } from '../../domain/repositories/project.repository';
import { FixedClock } from '../../test-utils/fixed-clock';
import {
  CachingProjectRepository,
  PROJECT_KEY_CACHE_TTL_MS,
  UNKNOWN_KEY_CACHE_LIMIT,
} from './caching-project.repository';

const PROJECT: Project = {
  id: 'a3f1c2d4-5b6e-4f70-8192-a3b4c5d6e7f8',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'UTC',
  conversionEvent: null,
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
};

function setup(answer: Project | null = PROJECT) {
  const lookups: string[] = [];
  const delegate: ProjectRepository = {
    findByPublicKey: (publicKey) => {
      lookups.push(publicKey);
      return Promise.resolve(answer);
    },
  };
  const clock = new FixedClock(new Date('2026-10-06T14:00:00.000Z'));
  return { repository: new CachingProjectRepository(delegate, clock), delegate, lookups, clock };
}

describe('CachingProjectRepository', () => {
  it('answers a known key from memory for 60 seconds', async () => {
    const { repository, lookups, clock } = setup();

    await repository.findByPublicKey('key');
    clock.advanceBy(PROJECT_KEY_CACHE_TTL_MS - 1);
    const project = await repository.findByPublicKey('key');

    expect(project).toEqual(PROJECT);
    expect(lookups).toEqual(['key']);
  });

  it('asks the database again once the entry is 60 seconds old', async () => {
    const { repository, lookups, clock } = setup();

    await repository.findByPublicKey('key');
    clock.advanceBy(PROJECT_KEY_CACHE_TTL_MS);
    await repository.findByPublicKey('key');

    expect(lookups).toEqual(['key', 'key']);
  });

  it('remembers an unknown key for 60 seconds, so a revoked key costs one lookup a minute', async () => {
    const { repository, lookups, clock } = setup(null);

    expect(await repository.findByPublicKey('revoked')).toBeNull();
    clock.advanceBy(PROJECT_KEY_CACHE_TTL_MS - 1);
    expect(await repository.findByPublicKey('revoked')).toBeNull();

    expect(lookups).toEqual(['revoked']);
  });

  it('asks the database again about an unknown key once 60 seconds have passed', async () => {
    const { repository, lookups, clock } = setup(null);

    await repository.findByPublicKey('revoked');
    clock.advanceBy(PROJECT_KEY_CACHE_TTL_MS);
    expect(await repository.findByPublicKey('revoked')).toBeNull();

    expect(lookups).toEqual(['revoked', 'revoked']);
  });

  it('keeps a bounded number of unknown keys, forgetting the oldest first, so random keys cannot fill the memory', async () => {
    const { delegate, lookups, clock } = setup(null);
    const repository = new CachingProjectRepository(delegate, clock, PROJECT_KEY_CACHE_TTL_MS, 2);

    await repository.findByPublicKey('first');
    await repository.findByPublicKey('second');
    await repository.findByPublicKey('third');
    await repository.findByPublicKey('second');
    await repository.findByPublicKey('first');

    expect(lookups).toEqual(['first', 'second', 'third', 'first']);
  });

  it('keeps a thousand unknown keys by default', async () => {
    const { repository, lookups } = setup(null);
    const keys = Array.from(
      { length: UNKNOWN_KEY_CACHE_LIMIT + 1 },
      (_, index) => `key-${String(index)}`,
    );
    for (const key of keys) {
      await repository.findByPublicKey(key);
    }
    lookups.length = 0;

    await repository.findByPublicKey('key-1');
    await repository.findByPublicKey('key-0');

    expect(UNKNOWN_KEY_CACHE_LIMIT).toBe(1_000);
    expect(lookups).toEqual(['key-0']);
  });
});
