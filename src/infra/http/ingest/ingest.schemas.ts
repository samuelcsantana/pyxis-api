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

export const ingestResultSchema = z
  .strictObject({
    accepted: z.int().min(0),
    duplicates: z.int().min(0),
    rejected: z.int().min(0),
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
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
