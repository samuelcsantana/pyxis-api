import { Inject, Injectable } from '@nestjs/common';
import { and, asc, between, count, eq } from 'drizzle-orm';
import type {
  Annotation,
  AnnotationChanges,
  AnnotationDraft,
} from '../../domain/annotations/annotation';
import type { DateRange } from '../../domain/queries/date-range';
import type {
  AnnotationCreation,
  AnnotationRepository,
} from '../../domain/repositories/annotation.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { aggregateRow, insertedRow } from '../database/inserted-row';
import { annotations } from '../database/schema/annotations';
import { projects } from '../database/schema/projects';

const annotationFields = {
  id: annotations.id,
  projectId: annotations.projectId,
  day: annotations.day,
  text: annotations.text,
  createdAt: annotations.createdAt,
  updatedAt: annotations.updatedAt,
};

function ofProject(projectId: string, annotationId: string) {
  return and(eq(annotations.id, annotationId), eq(annotations.projectId, projectId));
}

@Injectable()
export class DrizzleAnnotationRepository implements AnnotationRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  listInRange(projectId: string, range: DateRange): Promise<readonly Annotation[]> {
    return this.db
      .select(annotationFields)
      .from(annotations)
      .where(
        and(eq(annotations.projectId, projectId), between(annotations.day, range.from, range.to)),
      )
      .orderBy(asc(annotations.day), asc(annotations.createdAt), asc(annotations.id));
  }

  create(
    projectId: string,
    draft: AnnotationDraft,
    createdAt: Date,
    limit: number,
  ): Promise<AnnotationCreation> {
    return this.db.transaction(async (transaction) => {
      await transaction
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, projectId))
        .for('update');
      const held = aggregateRow(
        await transaction
          .select({ total: count() })
          .from(annotations)
          .where(eq(annotations.projectId, projectId)),
      );
      if (held.total >= limit) {
        return { outcome: 'limit_reached' };
      }
      const annotation: Annotation = insertedRow(
        await transaction
          .insert(annotations)
          .values({ projectId, ...draft, createdAt, updatedAt: createdAt })
          .returning(annotationFields),
      );
      return { outcome: 'created', annotation };
    });
  }

  async update(
    projectId: string,
    annotationId: string,
    changes: AnnotationChanges,
    updatedAt: Date,
  ): Promise<Annotation | null> {
    const [row] = await this.db
      .update(annotations)
      .set({ ...changes, updatedAt })
      .where(ofProject(projectId, annotationId))
      .returning(annotationFields);
    return row ?? null;
  }

  async delete(projectId: string, annotationId: string): Promise<boolean> {
    const deleted = await this.db
      .delete(annotations)
      .where(ofProject(projectId, annotationId))
      .returning({ id: annotations.id });
    return deleted.length > 0;
  }
}
