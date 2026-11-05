import { Logger } from '@nestjs/common';
import type { AccountStatus } from '../../domain/accounts/account-status';
import { MAX_ANNOTATIONS_PER_PROJECT } from '../../domain/annotations/annotation';
import { SubscriptionRequiredError } from '../../domain/errors/account.errors';
import {
  AnnotationLimitReachedError,
  AnnotationNotFoundError,
  InvalidAnnotationError,
} from '../../domain/errors/annotation.errors';
import { ProjectNotFoundError } from '../../domain/errors/project.errors';
import { InvalidRangeError } from '../../domain/errors/query.errors';
import { FixedClock } from '../../test-utils/fixed-clock';
import { InMemoryAccountRepository } from '../../test-utils/in-memory-account.repository';
import { InMemoryAdminUserRepository } from '../../test-utils/in-memory-admin-user.repository';
import {
  annotationIdOf,
  InMemoryAnnotationRepository,
} from '../../test-utils/in-memory-annotation.repository';
import { InMemoryProjectRepository } from '../../test-utils/in-memory-project.repository';
import { SequenceRandomSource } from '../../test-utils/sequence-random-source';
import { CreateProjectUseCase } from '../projects/create-project.usecase';
import { CreateAnnotationUseCase } from './create-annotation.usecase';
import { DeleteAnnotationUseCase } from './delete-annotation.usecase';
import { ListAnnotationsUseCase } from './list-annotations.usecase';
import { UpdateAnnotationUseCase } from './update-annotation.usecase';

const OWNER_ID = 'ad000000-0000-4000-a000-000000000001';
const MEMBER_ID = 'ad000000-0000-4000-a000-000000000002';
const NOW = new Date('2026-11-05T02:00:00.000Z');
const LATER = new Date('2026-11-05T02:30:00.000Z');

async function setup(status: AccountStatus = 'free') {
  const store = new InMemoryProjectRepository();
  const accounts = new InMemoryAccountRepository(new InMemoryAdminUserRepository());
  const account = await accounts.create({ ownerAdminId: OWNER_ID, status });
  store.addAccount(account.id, OWNER_ID);
  const random = new SequenceRandomSource(Array.from({ length: 62 }, (_, index) => index));
  const { projectId } = await new CreateProjectUseCase(store, random, accounts).execute({
    name: 'Shop',
    allowedOrigins: ['https://shop.example.com'],
    timezone: 'America/Sao_Paulo',
    accountId: account.id,
  });
  const project = await store.findById(projectId);
  if (project === null) {
    throw new Error('The project was not created.');
  }
  const annotations = new InMemoryAnnotationRepository();
  const clock = new FixedClock(NOW);
  return {
    project,
    annotations,
    clock,
    list: new ListAnnotationsUseCase(annotations, clock),
    create: new CreateAnnotationUseCase(store, accounts, annotations, clock),
    update: new UpdateAnnotationUseCase(store, accounts, annotations, clock),
    remove: new DeleteAnnotationUseCase(store, accounts, annotations),
  };
}

describe('CreateAnnotationUseCase', () => {
  let logs: unknown[];

  beforeEach(() => {
    logs = [];
    jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      logs.push(message);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('writes a note on the free plan too, and logs it without its text', async () => {
    const { create, project } = await setup('free');

    const annotation = await create.execute({
      adminUserId: OWNER_ID,
      projectId: project.id,
      day: '2026-11-04',
      text: ' Launched   the new pricing ',
    });

    expect(annotation).toEqual({
      id: annotationIdOf(1),
      projectId: project.id,
      day: '2026-11-04',
      text: 'Launched the new pricing',
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(logs).toEqual([
      { message: 'annotation.created', projectId: project.id, annotationId: annotationIdOf(1) },
    ]);
  });

  it('refuses a day still to come in the project time zone, though already started in UTC', async () => {
    const { create, annotations, project } = await setup();

    await expect(
      create.execute({
        adminUserId: OWNER_ID,
        projectId: project.id,
        day: '2026-11-05',
        text: 'Soon',
      }),
    ).rejects.toMatchObject({ code: 'invalid_annotation', field: 'day' });
    expect(annotations.stored).toEqual([]);
  });

  it('refuses an empty note before looking the project up', async () => {
    const { create } = await setup();

    await expect(
      create.execute({
        adminUserId: OWNER_ID,
        projectId: 'unknown',
        day: '2026-11-04',
        text: '  ',
      }),
    ).rejects.toBeInstanceOf(InvalidAnnotationError);
  });

  it('refuses a person who does not own the account as an unknown project', async () => {
    const { create, project } = await setup();

    await expect(
      create.execute({
        adminUserId: MEMBER_ID,
        projectId: project.id,
        day: '2026-11-04',
        text: 'X',
      }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });

  it('refuses an account without access', async () => {
    const { create, project } = await setup('ended');

    await expect(
      create.execute({
        adminUserId: OWNER_ID,
        projectId: project.id,
        day: '2026-11-04',
        text: 'X',
      }),
    ).rejects.toBeInstanceOf(SubscriptionRequiredError);
  });

  it('stops at the most notes a project keeps', async () => {
    const { create, project } = await setup();
    for (let index = 0; index < MAX_ANNOTATIONS_PER_PROJECT; index += 1) {
      await create.execute({
        adminUserId: OWNER_ID,
        projectId: project.id,
        day: '2026-11-04',
        text: `Note ${String(index)}`,
      });
    }

    await expect(
      create.execute({
        adminUserId: OWNER_ID,
        projectId: project.id,
        day: '2026-11-04',
        text: 'More',
      }),
    ).rejects.toBeInstanceOf(AnnotationLimitReachedError);
  });
});

describe('ListAnnotationsUseCase', () => {
  it('lists the notes of the range by day, then in the order they were written', async () => {
    const { create, list, clock, project } = await setup();
    const write = (day: string, text: string) =>
      create.execute({ adminUserId: OWNER_ID, projectId: project.id, day, text });
    await write('2026-11-04', 'Second on the 4th');
    await write('2026-10-01', 'Outside the range');
    await write('2026-11-02', 'On the 2nd');
    clock.advanceBy(-1);
    await write('2026-11-04', 'First on the 4th');

    const listed = await list.execute(project, '2026-11-01', '2026-11-04');

    expect(listed.map((annotation) => annotation.text)).toEqual([
      'On the 2nd',
      'First on the 4th',
      'Second on the 4th',
    ]);
  });

  it('refuses a range that ends after today in the project time zone', async () => {
    const { list, project } = await setup();

    await expect(list.execute(project, '2026-11-01', '2026-11-05')).rejects.toBeInstanceOf(
      InvalidRangeError,
    );
  });
});

describe('UpdateAnnotationUseCase', () => {
  async function written() {
    const context = await setup();
    const annotation = await context.create.execute({
      adminUserId: OWNER_ID,
      projectId: context.project.id,
      day: '2026-11-03',
      text: 'Launch',
    });
    const other = await context.create.execute({
      adminUserId: OWNER_ID,
      projectId: context.project.id,
      day: '2026-11-02',
      text: 'Another note',
    });
    context.clock.advanceBy(LATER.getTime() - NOW.getTime());
    return { ...context, annotation, other };
  }

  it('moves a note to another day and keeps its text', async () => {
    const { update, annotation, project } = await written();

    await expect(
      update.execute({
        adminUserId: OWNER_ID,
        projectId: project.id,
        annotationId: annotation.id,
        day: '2026-11-04',
      }),
    ).resolves.toEqual({ ...annotation, day: '2026-11-04', updatedAt: LATER });
  });

  it('leaves the other notes of the project alone', async () => {
    const { update, annotation, other, annotations, project } = await written();

    await update.execute({
      adminUserId: OWNER_ID,
      projectId: project.id,
      annotationId: annotation.id,
      text: 'Changed',
    });

    expect(annotations.stored).toContainEqual(other);
  });

  it('rewrites a note and keeps its day', async () => {
    const { update, annotation, project } = await written();

    await expect(
      update.execute({
        adminUserId: OWNER_ID,
        projectId: project.id,
        annotationId: annotation.id,
        text: '  Launch  day ',
      }),
    ).resolves.toEqual({ ...annotation, text: 'Launch day', updatedAt: LATER });
  });

  it('refuses to move a note to a day still to come', async () => {
    const { update, annotation, project } = await written();

    await expect(
      update.execute({
        adminUserId: OWNER_ID,
        projectId: project.id,
        annotationId: annotation.id,
        day: '2026-11-06',
      }),
    ).rejects.toBeInstanceOf(InvalidAnnotationError);
  });

  it('answers annotation_not_found for a note of no such id', async () => {
    const { update, project } = await written();

    await expect(
      update.execute({
        adminUserId: OWNER_ID,
        projectId: project.id,
        annotationId: annotationIdOf(9),
        text: 'X',
      }),
    ).rejects.toBeInstanceOf(AnnotationNotFoundError);
  });

  it('refuses a person who does not own the account', async () => {
    const { update, annotation, project } = await written();

    await expect(
      update.execute({
        adminUserId: MEMBER_ID,
        projectId: project.id,
        annotationId: annotation.id,
        text: 'X',
      }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });
});

describe('DeleteAnnotationUseCase', () => {
  it('deletes a note, and then answers annotation_not_found for it', async () => {
    const { create, remove, annotations, project } = await setup();
    const annotation = await create.execute({
      adminUserId: OWNER_ID,
      projectId: project.id,
      day: '2026-11-04',
      text: 'Launch',
    });
    const command = { adminUserId: OWNER_ID, projectId: project.id, annotationId: annotation.id };

    await remove.execute(command);

    expect(annotations.stored).toEqual([]);
    await expect(remove.execute(command)).rejects.toBeInstanceOf(AnnotationNotFoundError);
  });

  it('refuses a person who does not own the account', async () => {
    const { remove, project } = await setup();

    await expect(
      remove.execute({
        adminUserId: MEMBER_ID,
        projectId: project.id,
        annotationId: annotationIdOf(1),
      }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });
});
