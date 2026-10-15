import { ProjectNotFoundError } from '../../domain/errors/project.errors';
import type { ProjectDeletionHoldRepository } from '../../domain/repositories/project-deletion-hold.repository';
import { FixedClock } from '../../test-utils/fixed-clock';
import { InMemoryProjectDeletionHoldRepository } from '../../test-utils/in-memory-project-deletion-hold.repository';
import { HoldProjectDeletionUseCase } from './hold-project-deletion.usecase';
import { ReleaseProjectDeletionUseCase } from './release-project-deletion.usecase';

const NOW = new Date('2026-10-15T14:00:00.000Z');
const LATER = new Date('2026-10-16T09:00:00.000Z');
const PROJECT_ID = '11111111-0000-4000-8000-000000000001';
const MISSING_ID = '11111111-0000-4000-8000-000000000009';

function setup() {
  const holds = new InMemoryProjectDeletionHoldRepository();
  holds.add(PROJECT_ID, 'Shop');
  return {
    hold: (at: Date) => new HoldProjectDeletionUseCase(holds, new FixedClock(at)),
    release: new ReleaseProjectDeletionUseCase(holds),
  };
}

describe('holding and releasing the deletion of a project', () => {
  it('holds the deletion with the reason, from now', async () => {
    const { hold } = setup();

    await expect(
      hold(NOW).execute({ projectId: PROJECT_ID, reason: 'Court order' }),
    ).resolves.toEqual({
      projectId: PROJECT_ID,
      projectName: 'Shop',
      heldAt: NOW,
      reason: 'Court order',
    });
  });

  it('keeps the moment of the first hold when the reason is written again', async () => {
    const { hold } = setup();
    await hold(NOW).execute({ projectId: PROJECT_ID, reason: 'Court order' });

    await expect(
      hold(LATER).execute({ projectId: PROJECT_ID, reason: 'Court order, extended' }),
    ).resolves.toMatchObject({ heldAt: NOW, reason: 'Court order, extended' });
  });

  it('refuses a project that does not exist', async () => {
    const { hold, release } = setup();

    await expect(
      hold(NOW).execute({ projectId: MISSING_ID, reason: 'Court order' }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
    await expect(release.execute({ projectId: MISSING_ID })).rejects.toBeInstanceOf(
      ProjectNotFoundError,
    );
  });

  it('refuses a project deleted between reading and writing the hold', async () => {
    const vanishing: ProjectDeletionHoldRepository = {
      holdOf: () =>
        Promise.resolve({ projectId: PROJECT_ID, projectName: 'Shop', heldAt: null, reason: null }),
      hold: () => Promise.resolve(null),
      release: () => Promise.resolve(null),
    };

    await expect(
      new HoldProjectDeletionUseCase(vanishing, new FixedClock(NOW)).execute({
        projectId: PROJECT_ID,
        reason: 'Court order',
      }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });

  it('releases the hold, clearing the moment and the reason', async () => {
    const { hold, release } = setup();
    await hold(NOW).execute({ projectId: PROJECT_ID, reason: 'Court order' });

    await expect(release.execute({ projectId: PROJECT_ID })).resolves.toEqual({
      projectId: PROJECT_ID,
      projectName: 'Shop',
      heldAt: null,
      reason: null,
    });
  });
});
