import { InvalidAnnotationError } from '../errors/annotation.errors';
import {
  MAX_ANNOTATION_INPUT_UNITS,
  MAX_ANNOTATION_LENGTH,
  MAX_ANNOTATIONS_PER_PROJECT,
  requireAnnotationDay,
  requireAnnotationText,
} from './annotation';

describe('the annotation limits', () => {
  it('keep a note short, a project’s notes bounded, and the raw input twice the note', () => {
    expect({
      MAX_ANNOTATION_LENGTH,
      MAX_ANNOTATION_INPUT_UNITS,
      MAX_ANNOTATIONS_PER_PROJECT,
    }).toEqual({
      MAX_ANNOTATION_LENGTH: 140,
      MAX_ANNOTATION_INPUT_UNITS: 280,
      MAX_ANNOTATIONS_PER_PROJECT: 1000,
    });
  });
});

describe('requireAnnotationText', () => {
  it('collapses spaces and line breaks into one and trims the note', () => {
    expect(requireAnnotationText('  Launched\n\nthe   new pricing\t')).toBe(
      'Launched the new pricing',
    );
  });

  it('counts characters, so a note of 140 emoji fits', () => {
    const emoji = '🚀'.repeat(MAX_ANNOTATION_LENGTH);

    expect(requireAnnotationText(emoji)).toBe(emoji);
  });

  it.each([
    ['an empty note', ' \n '],
    ['a note one character too long', 'x'.repeat(MAX_ANNOTATION_LENGTH + 1)],
  ])('refuses %s', (_case, text) => {
    expect(() => requireAnnotationText(text)).toThrow(InvalidAnnotationError);
    expect(() => requireAnnotationText(text)).toThrow('An annotation has 1 to 140 characters.');
  });
});

describe('requireAnnotationDay', () => {
  it('accepts today and any day before', () => {
    expect(requireAnnotationDay('2026-11-05', '2026-11-05')).toBe('2026-11-05');
    expect(requireAnnotationDay('2025-01-31', '2026-11-05')).toBe('2025-01-31');
  });

  it('refuses a day that has not started in the project time zone', () => {
    expect(() => requireAnnotationDay('2026-11-06', '2026-11-05')).toThrow(InvalidAnnotationError);
  });
});
