import type { Project } from '../../domain/entities/project.entity';
import type { ProjectRepository } from '../../domain/repositories/project.repository';
import { FixedClock } from '../../test-utils/fixed-clock';
import { CachingProjectRepository, PROJECT_KEY_CACHE_TTL_MS } from './caching-project.repository';

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
  return { repository: new CachingProjectRepository(delegate, clock), lookups, clock };
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

  it('never remembers an unknown key, so random keys cannot fill the memory', async () => {
    const { repository, lookups } = setup(null);

    expect(await repository.findByPublicKey('unknown')).toBeNull();
    expect(await repository.findByPublicKey('unknown')).toBeNull();
    expect(lookups).toEqual(['unknown', 'unknown']);
  });
});
