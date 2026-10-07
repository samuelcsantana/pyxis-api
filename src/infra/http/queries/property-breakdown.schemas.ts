import { z } from 'zod';
import { EVENT_NAME_PATTERN } from '../../../domain/events/event-limits';
import { TOP_PROPERTY_VALUES } from '../../../domain/queries/property-breakdown';
import { rangeQuerySchema } from './query.schemas';

export const propertyBreakdownQuerySchema = rangeQuerySchema.extend({
  name: z.string().regex(EVENT_NAME_PATTERN).describe('The named event to break down'),
});

export const propertyBreakdownReportSchema = z
  .strictObject({
    name: z.string(),
    events: z.int(),
    keys: z.array(
      z.strictObject({
        key: z.string(),
        events: z.int(),
        values: z.array(z.strictObject({ value: z.string(), count: z.int(), visits: z.int() })),
        other_count: z.int(),
      }),
    ),
  })
  .meta({
    id: 'PropertyBreakdownReport',
    description:
      'How the properties of one named event break down in the range. events counts the event; ' +
      'for each key, events counts those that carry it, values are its ' +
      `${String(TOP_PROPERTY_VALUES)} most frequent values (text, as sent: true, 12.5) with ` +
      'their count and visits, and other_count the events with any other value. Keys come in ' +
      'order of the events that carry them; a reserved event (page_view, identify, api_request) ' +
      'answers 0 events and no keys.',
  });

export type PropertyBreakdownQuery = z.infer<typeof propertyBreakdownQuerySchema>;
export type PropertyBreakdownReportBody = z.infer<typeof propertyBreakdownReportSchema>;
