import { InvalidAnnotationError } from '../errors/annotation.errors';

export const MAX_ANNOTATION_LENGTH = 140;
export const MAX_ANNOTATION_INPUT_UNITS = 2 * MAX_ANNOTATION_LENGTH;
export const MAX_ANNOTATIONS_PER_PROJECT = 1000;

export interface Annotation {
  readonly id: string;
  readonly projectId: string;
  readonly day: string;
  readonly text: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface AnnotationDraft {
  readonly day: string;
  readonly text: string;
}

export interface AnnotationChanges {
  readonly day?: string;
  readonly text?: string;
}

const WHITESPACE_RUNS = /\s+/g;

export function requireAnnotationText(text: string): string {
  const normalized = text.replace(WHITESPACE_RUNS, ' ').trim();
  const length = Array.from(normalized).length;
  if (length === 0 || length > MAX_ANNOTATION_LENGTH) {
    throw new InvalidAnnotationError(
      'text',
      `An annotation has 1 to ${String(MAX_ANNOTATION_LENGTH)} characters.`,
    );
  }
  return normalized;
}

export function requireAnnotationDay(day: string, today: string): string {
  if (day > today) {
    throw new InvalidAnnotationError(
      'day',
      'An annotation marks a day that has started in the project time zone, today at the latest.',
    );
  }
  return day;
}
