import { z } from 'zod';
import { MAX_EVENTS_PER_BATCH } from '../../../domain/events/event-limits';
import { incomingEventSchema } from '../../../domain/events/incoming-event.schema';
import { PUBLIC_KEY_PATTERN } from '../../../domain/keys/project-keys';

const keySchema = z.string().regex(PUBLIC_KEY_PATTERN);
const sentAtSchema = z.iso.datetime({ offset: true });

export const batchEnvelopeSchema = z.strictObject({
  key: keySchema,
  sent_at: sentAtSchema,
  events: z.array(z.unknown()).min(1),
});

export const batchRequestSchema = z
  .strictObject({
    key: keySchema,
    sent_at: sentAtSchema,
    events: z
      .array(
        incomingEventSchema.meta({
          id: 'IncomingEvent',
          description:
            'One event. An event that breaks these rules is counted as rejected while the rest ' +
            'of its batch is kept.',
        }),
      )
      .min(1)
      .max(MAX_EVENTS_PER_BATCH),
  })
  .meta({
    id: 'BatchRequest',
    description:
      'A batch of events from the browser, sent as text/plain or application/json. More than ' +
      `${String(MAX_EVENTS_PER_BATCH)} events answer 413.`,
  });

const periodEndSchema = z.iso.datetime();

export const visitorPeriodSchema = z
  .strictObject({
    day_ends_at: periodEndSchema.describe("The next midnight in the project's time zone, in UTC"),
    month_ends_at: periodEndSchema.describe(
      "The first instant of next month in the project's time zone, in UTC",
    ),
  })
  .meta({
    id: 'VisitorPeriod',
    description:
      "When the site's day and month end, the same for every visitor of the site that day. " +
      'Present only when the project counts unique visitors: the tracker keeps it to tell the ' +
      'kind of its next visit, and deletes what it kept when a successful answer comes without it.',
  });

export const ingestResultSchema = z
  .strictObject({
    accepted: z.int().min(0),
    duplicates: z.int().min(0),
    rejected: z.int().min(0),
    visitor_period: visitorPeriodSchema.optional(),
  })
  .meta({ id: 'IngestResult', description: 'What happened to each event of the batch.' });

export const errorResponseSchema = z
  .strictObject({
    status_code: z.int(),
    error: z.string(),
    message: z.string(),
  })
  .meta({
    id: 'ErrorResponse',
    description: 'A stable machine key in error and a message for humans that never echoes input.',
  });

export type BatchEnvelope = z.infer<typeof batchEnvelopeSchema>;
export type IngestResult = z.infer<typeof ingestResultSchema>;
export type VisitorPeriodBody = z.infer<typeof visitorPeriodSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
