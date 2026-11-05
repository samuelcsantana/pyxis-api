import type { FastifyRequest } from 'fastify';
import type { Annotation } from '../../../domain/annotations/annotation';
import type { CreateAnnotationByKeyUseCase } from '../../../usecases/annotations/create-annotation-by-key.usecase';
import { AnnotationsByKeyController } from './annotations-by-key.controller';
import { annotationSchema, newAnnotationSchema } from './annotations.schemas';

const PROJECT_ID = '6f1d3c2a-8b4e-4f7a-9c1d-2e3f4a5b6c7d';
const ANNOTATION: Annotation = {
  id: '00000000-0000-4000-a000-000000000001',
  projectId: PROJECT_ID,
  day: '2026-11-04',
  text: 'Released v2.4.0',
  createdAt: new Date('2026-11-05T02:00:00.000Z'),
  updatedAt: new Date('2026-11-05T02:00:00.000Z'),
};

describe('AnnotationsByKeyController', () => {
  it('writes the note on the project of the secret key the guard read', async () => {
    const asked: unknown[][] = [];
    const controller = new AnnotationsByKeyController({
      execute: (...args: unknown[]) => {
        asked.push(args);
        return Promise.resolve(ANNOTATION);
      },
    } as unknown as CreateAnnotationByKeyUseCase);
    const request = {
      secretKey: { keyId: 'k-1', projectId: PROJECT_ID, secretHash: 'h' },
    } as unknown as FastifyRequest;

    const body = await controller.create(
      request,
      newAnnotationSchema.parse({ day: '2026-11-04', text: 'Released v2.4.0' }),
    );

    expect(annotationSchema.parse(body)).toEqual({
      id: ANNOTATION.id,
      day: '2026-11-04',
      text: 'Released v2.4.0',
      created_at: '2026-11-05T02:00:00.000Z',
      updated_at: '2026-11-05T02:00:00.000Z',
    });
    expect(asked).toEqual([[PROJECT_ID, { day: '2026-11-04', text: 'Released v2.4.0' }]]);
  });
});
