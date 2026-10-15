import { ProjectNotFoundError } from '../../domain/errors/project.errors';
import type { ProjectSuspensionRepository } from '../../domain/repositories/project-suspension.repository';
import { FixedClock } from '../../test-utils/fixed-clock';
import { InMemoryProjectSuspensionRepository } from '../../test-utils/in-memory-project-suspension.repository';
import { ResumeProjectIngestionUseCase } from './resume-project-ingestion.usecase';
import { SuspendProjectIngestionUseCase } from './suspend-project-ingestion.usecase';

const NOW = new Date('2026-10-15T14:00:00.000Z');
const LATER = new Date('2026-10-16T09:00:00.000Z');
const PROJECT_ID = '11111111-0000-4000-8000-000000000001';
const MISSING_ID = '11111111-0000-4000-8000-000000000009';

function setup() {
  const suspensions = new InMemoryProjectSuspensionRepository();
  suspensions.add(PROJECT_ID, 'Shop');
  return {
    suspensions,
    suspend: (at: Date) => new SuspendProjectIngestionUseCase(suspensions, new FixedClock(at)),
    resume: new ResumeProjectIngestionUseCase(suspensions),
  };
}

describe('suspending and resuming the reception of a project', () => {
  it('suspends the reception with the reason, from now', async () => {
    const { suspend } = setup();

    await expect(
      suspend(NOW).execute({ projectId: PROJECT_ID, reason: 'Forged traffic.' }),
    ).resolves.toEqual({
      projectId: PROJECT_ID,
      projectName: 'Shop',
      suspendedAt: NOW,
      reason: 'Forged traffic.',
    });
  });

  it('keeps the moment of the first suspension when the reason is written again', async () => {
    const { suspend } = setup();
    await suspend(NOW).execute({ projectId: PROJECT_ID, reason: 'Forged traffic.' });

    await expect(
      suspend(LATER).execute({ projectId: PROJECT_ID, reason: 'Forged traffic, again.' }),
    ).resolves.toMatchObject({ suspendedAt: NOW, reason: 'Forged traffic, again.' });
  });

  it('refuses a project that does not exist', async () => {
    const { suspend, resume } = setup();

    await expect(
      suspend(NOW).execute({ projectId: MISSING_ID, reason: 'Forged traffic.' }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
    await expect(resume.execute({ projectId: MISSING_ID })).rejects.toBeInstanceOf(
      ProjectNotFoundError,
    );
  });

  it('refuses a project deleted between reading and writing the suspension', async () => {
    const vanishing: ProjectSuspensionRepository = {
      suspensionOf: () =>
        Promise.resolve({
          projectId: PROJECT_ID,
          projectName: 'Shop',
          suspendedAt: null,
          reason: null,
        }),
      suspend: () => Promise.resolve(null),
      resume: () => Promise.resolve(null),
    };

    await expect(
      new SuspendProjectIngestionUseCase(vanishing, new FixedClock(NOW)).execute({
        projectId: PROJECT_ID,
        reason: 'Forged traffic.',
      }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });

  it('lifts the suspension, clearing the moment and the reason', async () => {
    const { suspend, resume } = setup();
    await suspend(NOW).execute({ projectId: PROJECT_ID, reason: 'Forged traffic.' });

    await expect(resume.execute({ projectId: PROJECT_ID })).resolves.toEqual({
      projectId: PROJECT_ID,
      projectName: 'Shop',
      suspendedAt: null,
      reason: null,
    });
  });
});
