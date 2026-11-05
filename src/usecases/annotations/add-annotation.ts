import { Logger } from '@nestjs/common';
import {
  type Annotation,
  MAX_ANNOTATIONS_PER_PROJECT,
  requireAnnotationDay,
} from '../../domain/annotations/annotation';
import type { Project } from '../../domain/entities/project.entity';
import { AnnotationLimitReachedError } from '../../domain/errors/annotation.errors';
import { todayIn } from '../../domain/queries/date-range';
import type { AnnotationRepository } from '../../domain/repositories/annotation.repository';

const logger = new Logger('Annotations');

export interface AnnotationInput {
  readonly day: string;
  readonly text: string;
}

export async function addAnnotation(
  annotations: AnnotationRepository,
  project: Project,
  input: AnnotationInput,
  now: Date,
): Promise<Annotation> {
  const day = requireAnnotationDay(input.day, todayIn(project.timezone, now));
  const created = await annotations.create(
    project.id,
    { day, text: input.text },
    now,
    MAX_ANNOTATIONS_PER_PROJECT,
  );
  if (created.outcome === 'limit_reached') {
    throw new AnnotationLimitReachedError(MAX_ANNOTATIONS_PER_PROJECT);
  }
  logger.log({
    message: 'annotation.created',
    projectId: project.id,
    annotationId: created.annotation.id,
  });
  return created.annotation;
}
