import { z } from 'zod';
import {
  type Annotation,
  MAX_ANNOTATION_INPUT_UNITS,
  MAX_ANNOTATION_LENGTH,
} from '../../../domain/annotations/annotation';

const daySchema = z.iso
  .date()
  .describe('The day the note marks, in the project time zone; today at the latest');
const textSchema = z
  .string()
  .max(MAX_ANNOTATION_INPUT_UNITS)
  .describe(
    `The note, 1 to ${String(MAX_ANNOTATION_LENGTH)} characters once its spaces are collapsed ` +
      'into one and trimmed',
  );

export const annotationIdSchema = z.uuid();

export const newAnnotationSchema = z
  .strictObject({ day: daySchema, text: textSchema })
  .meta({ id: 'NewAnnotation' });

export const annotationChangesSchema = z
  .strictObject({ day: daySchema.optional(), text: textSchema.optional() })
  .refine((changes) => changes.day !== undefined || changes.text !== undefined, {
    message: 'Send the day, the text or both.',
  })
  .meta({ id: 'AnnotationChanges' });

export const annotationSchema = z
  .strictObject({
    id: z.uuid(),
    day: z.iso.date(),
    text: z.string(),
    created_at: z.iso.datetime(),
    updated_at: z.iso.datetime(),
  })
  .meta({ id: 'Annotation', description: 'A short note on a day of the project.' });

export const annotationListSchema = z
  .strictObject({ annotations: z.array(annotationSchema) })
  .meta({
    id: 'AnnotationList',
    description: 'The notes on the days of the range, by day, then in the order they were written.',
  });

export type NewAnnotationBody = z.infer<typeof newAnnotationSchema>;
export type AnnotationChangesBody = z.infer<typeof annotationChangesSchema>;
export type AnnotationBody = z.infer<typeof annotationSchema>;
export type AnnotationListBody = z.infer<typeof annotationListSchema>;

export function annotationBody(annotation: Annotation): AnnotationBody {
  return {
    id: annotation.id,
    day: annotation.day,
    text: annotation.text,
    created_at: annotation.createdAt.toISOString(),
    updated_at: annotation.updatedAt.toISOString(),
  };
}

export function annotationListBody(annotations: readonly Annotation[]): AnnotationListBody {
  return { annotations: annotations.map(annotationBody) };
}
