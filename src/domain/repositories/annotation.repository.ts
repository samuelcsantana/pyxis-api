import type { Annotation, AnnotationChanges, AnnotationDraft } from '../annotations/annotation';
import type { DateRange } from '../queries/date-range';

export type AnnotationCreation =
  | { readonly outcome: 'created'; readonly annotation: Annotation }
  | { readonly outcome: 'limit_reached' };

export interface AnnotationRepository {
  listInRange(projectId: string, range: DateRange): Promise<readonly Annotation[]>;
  create(
    projectId: string,
    draft: AnnotationDraft,
    createdAt: Date,
    limit: number,
  ): Promise<AnnotationCreation>;
  update(
    projectId: string,
    annotationId: string,
    changes: AnnotationChanges,
    updatedAt: Date,
  ): Promise<Annotation | null>;
  delete(projectId: string, annotationId: string): Promise<boolean>;
}

export const ANNOTATION_REPOSITORY = Symbol('AnnotationRepository');
