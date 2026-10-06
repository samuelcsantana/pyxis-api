import { z } from 'zod';
import { USER_ID_PATTERN } from '../../../domain/events/event-limits';

export const userIdSchema = z.string().regex(USER_ID_PATTERN);

export const exportQuerySchema = z.strictObject({ after: z.uuid().optional() });

export const erasedSubjectSchema = z.strictObject({ deleted_events: z.int() }).meta({
  id: 'ErasedSubject',
  description:
    "How many events were deleted: the user's and those of every visit they identified in. " +
    'Zero is success too, so a retry after a timeout is safe.',
});

export const subjectEventsSchema = z
  .strictObject({
    events: z.array(
      z.strictObject({
        id: z.uuid(),
        name: z.string(),
        occurred_at: z.iso.datetime(),
        session_id: z.uuid(),
        path: z.string(),
        referrer_host: z.string().nullable(),
        utm_source: z.string().nullable(),
        utm_medium: z.string().nullable(),
        utm_campaign: z.string().nullable(),
        from_ad_click: z.boolean(),
        device_type: z.string(),
        browser: z.string(),
        os: z.string(),
        country: z.string().nullable(),
        properties: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
      }),
    ),
    next_after: z.uuid().nullable(),
  })
  .meta({
    id: 'SubjectEvents',
    description:
      'Every event about the user, oldest first, 1,000 per page; pass next_after as after for ' +
      'the next page, null on the last one.',
  });

export type ExportQuery = z.infer<typeof exportQuerySchema>;
export type ErasedSubjectBody = z.infer<typeof erasedSubjectSchema>;
export type SubjectEventsBody = z.infer<typeof subjectEventsSchema>;
