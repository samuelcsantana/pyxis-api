import type {
  Annotation,
  AnnotationChanges,
  AnnotationDraft,
} from '../domain/annotations/annotation';
import type { DateRange } from '../domain/queries/date-range';
import type {
  AnnotationCreation,
  AnnotationRepository,
} from '../domain/repositories/annotation.repository';

const ID_DIGITS = 12;

export function annotationIdOf(sequence: number): string {
  return `00000000-0000-4000-a000-${String(sequence).padStart(ID_DIGITS, '0')}`;
}

function inDayOrder(left: Annotation, right: Annotation): number {
  return left.day.localeCompare(right.day) || left.createdAt.getTime() - right.createdAt.getTime();
}

export class InMemoryAnnotationRepository implements AnnotationRepository {
  private annotations: readonly Annotation[] = [];
  private sequence = 0;

  get stored(): readonly Annotation[] {
    return this.annotations;
  }

  listInRange(projectId: string, range: DateRange): Promise<readonly Annotation[]> {
    return Promise.resolve(
      this.annotations
        .filter(
          (annotation) =>
            annotation.projectId === projectId &&
            annotation.day >= range.from &&
            annotation.day <= range.to,
        )
        .toSorted(inDayOrder),
    );
  }

  create(
    projectId: string,
    draft: AnnotationDraft,
    createdAt: Date,
    limit: number,
  ): Promise<AnnotationCreation> {
    const held = this.annotations.filter((annotation) => annotation.projectId === projectId);
    if (held.length >= limit) {
      return Promise.resolve({ outcome: 'limit_reached' });
    }
    this.sequence += 1;
    const annotation: Annotation = {
      id: annotationIdOf(this.sequence),
      projectId,
      ...draft,
      createdAt,
      updatedAt: createdAt,
    };
    this.annotations = [...this.annotations, annotation];
    return Promise.resolve({ outcome: 'created', annotation });
  }

  update(
    projectId: string,
    annotationId: string,
    changes: AnnotationChanges,
    updatedAt: Date,
  ): Promise<Annotation | null> {
    const found = this.annotations.find(
      (annotation) => annotation.id === annotationId && annotation.projectId === projectId,
    );
    if (found === undefined) {
      return Promise.resolve(null);
    }
    const updated: Annotation = { ...found, ...changes, updatedAt };
    this.annotations = this.annotations.map((annotation) =>
      annotation === found ? updated : annotation,
    );
    return Promise.resolve(updated);
  }

  delete(projectId: string, annotationId: string): Promise<boolean> {
    const before = this.annotations.length;
    this.annotations = this.annotations.filter(
      (annotation) => !(annotation.id === annotationId && annotation.projectId === projectId),
    );
    return Promise.resolve(this.annotations.length < before);
  }
}
