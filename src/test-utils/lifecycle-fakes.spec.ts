import { InMemoryAccountLifecycleRepository } from './in-memory-account-lifecycle.repository';

describe('InMemoryAccountLifecycleRepository', () => {
  it('deletes no event of a project it does not know', async () => {
    const lifecycle = new InMemoryAccountLifecycleRepository();

    await expect(lifecycle.deleteEventsOf('unknown', 10)).resolves.toBe(0);
  });

  it('ignores a mark for an account it does not know', async () => {
    const lifecycle = new InMemoryAccountLifecycleRepository();

    await lifecycle.markReminded('unknown', new Date('2026-12-01T00:00:00.000Z'));

    expect(lifecycle.account('unknown')).toBeUndefined();
  });
});
