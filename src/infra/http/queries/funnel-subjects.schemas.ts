import { z } from 'zod';
import {
  FUNNEL_OUTCOMES,
  FUNNEL_SUBJECTS_PAGE_SIZE,
  type FunnelSubjectCursor,
  MAX_FUNNEL_STEPS,
} from '../../../domain/queries/funnel';
import { funnelQuerySchema } from './query.schemas';

const CURSOR_SEPARATOR = '~';
const FIRST_STEP = 1;

export function funnelSubjectCursorText(cursor: FunnelSubjectCursor): string {
  return `${cursor.lastStepAt.toISOString()}${CURSOR_SEPARATOR}${cursor.id}`;
}

const cursorSchema = z.string().transform((text, context): FunnelSubjectCursor => {
  const separator = text.indexOf(CURSOR_SEPARATOR);
  const lastStepAt = z.iso.datetime().safeParse(text.slice(0, separator));
  const id = text.slice(separator + 1);
  if (separator < 0 || !lastStepAt.success || id.length === 0) {
    context.addIssue({ code: 'custom', message: 'cursor must be a next_cursor' });
    return z.NEVER;
  }
  return { lastStepAt: new Date(lastStepAt.data), id };
});

export const funnelSubjectsQuerySchema = funnelQuerySchema
  .extend({
    step: z.coerce.number().int().min(FIRST_STEP).max(MAX_FUNNEL_STEPS),
    outcome: z.enum(FUNNEL_OUTCOMES),
    cursor: cursorSchema.optional(),
  })
  .refine((query) => query.step <= query.steps.length, {
    message: 'step must be one of the steps',
    path: ['step'],
  })
  .refine((query) => query.outcome === 'reached' || query.step > FIRST_STEP, {
    message: 'nobody drops before the first step',
    path: ['step'],
  });

export const funnelSubjectsReportSchema = z
  .strictObject({
    subjects: z.array(z.strictObject({ id: z.string(), last_step_at: z.iso.datetime() })),
    next_cursor: z.string().nullable(),
  })
  .meta({
    id: 'FunnelSubjectsReport',
    description:
      'The visits (mode=visit: session ids) or identified people (mode=user: user ids) behind ' +
      'one step of a funnel: outcome=reached those who reached step n (1 is the first), ' +
      'outcome=dropped those who reached step n - 1 and never step n. last_step_at is when they ' +
      `reached the last step they did; newest first, ${String(FUNNEL_SUBJECTS_PAGE_SIZE)} per ` +
      'page. next_cursor goes back as cursor for the older page, null on the last one.',
  });

export type FunnelSubjectsQuery = z.infer<typeof funnelSubjectsQuerySchema>;
export type FunnelSubjectsReportBody = z.infer<typeof funnelSubjectsReportSchema>;
