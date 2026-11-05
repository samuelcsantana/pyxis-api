import type { FastifyRequest } from 'fastify';
import type { Annotation } from '../../../domain/annotations/annotation';
import type { AdminUser } from '../../../domain/entities/admin-user.entity';
import type { Project } from '../../../domain/entities/project.entity';
import type {
  CreateAnnotationCommand,
  CreateAnnotationUseCase,
} from '../../../usecases/annotations/create-annotation.usecase';
import type {
  DeleteAnnotationCommand,
  DeleteAnnotationUseCase,
} from '../../../usecases/annotations/delete-annotation.usecase';
import type { ListAnnotationsUseCase } from '../../../usecases/annotations/list-annotations.usecase';
import type {
  UpdateAnnotationCommand,
  UpdateAnnotationUseCase,
} from '../../../usecases/annotations/update-annotation.usecase';
import { AnnotationSettingsController } from './annotation-settings.controller';
import { AnnotationsController } from './annotations.controller';
import {
  annotationChangesSchema,
  annotationListSchema,
  annotationSchema,
  newAnnotationSchema,
} from './annotations.schemas';

const PROJECT: Project = {
  id: '6f1d3c2a-8b4e-4f7a-9c1d-2e3f4a5b6c7d',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'America/Sao_Paulo',
  conversionEvent: null,
  currency: 'BRL',
  cityEnabled: false,
  visitorsEnabled: false,
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
};
const ADMIN: AdminUser = {
  id: '3e0b4f5a-6c7d-4e8f-9a0b-1c2d3e4f5a6b',
  email: 'ana@example.com',
  emailLanguage: 'en',
  suspendedAt: null,
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
};
const ANNOTATION: Annotation = {
  id: '00000000-0000-4000-a000-000000000001',
  projectId: PROJECT.id,
  day: '2026-11-03',
  text: 'Launched the new pricing',
  createdAt: new Date('2026-11-03T15:00:00.000Z'),
  updatedAt: new Date('2026-11-04T09:00:00.000Z'),
};
const ANNOTATION_BODY = {
  id: ANNOTATION.id,
  day: '2026-11-03',
  text: 'Launched the new pricing',
  created_at: '2026-11-03T15:00:00.000Z',
  updated_at: '2026-11-04T09:00:00.000Z',
};
const REQUEST = { admin: ADMIN, project: PROJECT } as unknown as FastifyRequest;

describe('AnnotationsController', () => {
  it('lists the notes of the range of the project the guard read', async () => {
    const asked: unknown[][] = [];
    const controller = new AnnotationsController({
      execute: (...args: unknown[]) => {
        asked.push(args);
        return Promise.resolve([ANNOTATION]);
      },
    } as unknown as ListAnnotationsUseCase);

    const body = await controller.list(REQUEST, { from: '2026-11-01', to: '2026-11-04' });

    expect(annotationListSchema.parse(body)).toEqual({ annotations: [ANNOTATION_BODY] });
    expect(asked).toEqual([[PROJECT, '2026-11-01', '2026-11-04']]);
  });
});

describe('AnnotationSettingsController', () => {
  function writeController() {
    const created: CreateAnnotationCommand[] = [];
    const updated: UpdateAnnotationCommand[] = [];
    const deleted: DeleteAnnotationCommand[] = [];
    return {
      created,
      updated,
      deleted,
      controller: new AnnotationSettingsController(
        {
          execute: (command: CreateAnnotationCommand) => {
            created.push(command);
            return Promise.resolve(ANNOTATION);
          },
        } as unknown as CreateAnnotationUseCase,
        {
          execute: (command: UpdateAnnotationCommand) => {
            updated.push(command);
            return Promise.resolve(ANNOTATION);
          },
        } as unknown as UpdateAnnotationUseCase,
        {
          execute: (command: DeleteAnnotationCommand) => {
            deleted.push(command);
            return Promise.resolve();
          },
        } as unknown as DeleteAnnotationUseCase,
      ),
    };
  }

  it('writes a note for the signed-in admin', async () => {
    const { controller, created } = writeController();

    const body = await controller.create(
      REQUEST,
      PROJECT.id,
      newAnnotationSchema.parse({ day: '2026-11-03', text: 'Launched the new pricing' }),
    );

    expect(annotationSchema.parse(body)).toEqual(ANNOTATION_BODY);
    expect(created).toEqual([
      {
        adminUserId: ADMIN.id,
        projectId: PROJECT.id,
        day: '2026-11-03',
        text: 'Launched the new pricing',
      },
    ]);
  });

  it.each([
    ['the day', { day: '2026-11-04' }],
    ['the text', { text: 'Pricing v2' }],
    ['both', { day: '2026-11-04', text: 'Pricing v2' }],
  ])('passes on %s and nothing else', async (_case, input) => {
    const { controller, updated } = writeController();

    await controller.update(
      REQUEST,
      PROJECT.id,
      ANNOTATION.id,
      annotationChangesSchema.parse(input),
    );

    expect(updated).toEqual([
      { adminUserId: ADMIN.id, projectId: PROJECT.id, annotationId: ANNOTATION.id, ...input },
    ]);
  });

  it('deletes a note of the project', async () => {
    const { controller, deleted } = writeController();

    await controller.remove(REQUEST, PROJECT.id, ANNOTATION.id);

    expect(deleted).toEqual([
      { adminUserId: ADMIN.id, projectId: PROJECT.id, annotationId: ANNOTATION.id },
    ]);
  });

  it.each([
    ['a day that is not a date', newAnnotationSchema, { day: '2026-11-31', text: 'X' }],
    [
      'a note longer than the input allows',
      newAnnotationSchema,
      { day: '2026-11-03', text: 'x'.repeat(281) },
    ],
    ['an unknown field', newAnnotationSchema, { day: '2026-11-03', text: 'X', author: 'Ana' }],
    ['no change', annotationChangesSchema, {}],
  ])('refuses %s at the edge', (_case, schema, body) => {
    expect(schema.safeParse(body).success).toBe(false);
  });
});
