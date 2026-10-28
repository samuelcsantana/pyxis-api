import { z } from 'zod';
import { EVENT_NAME_PATTERN, PROPERTY_KEY_PATTERN } from '../../../domain/events/event-limits';
import { TOP_SUMMARY_GROUPS } from '../../../domain/queries/property-summary';
import { propertyNeedsEvent, rangeQuerySchema, reportFilterFields } from './query.schemas';

export const propertySummaryQuerySchema = propertyNeedsEvent(
  rangeQuerySchema.extend({
    name: z.string().regex(EVENT_NAME_PATTERN).describe('The named event whose property to sum up'),
    key: z
      .string()
      .regex(PROPERTY_KEY_PATTERN)
      .describe('The property whose numbers to sum up, such as seconds'),
    by: z
      .string()
      .regex(PROPERTY_KEY_PATTERN)
      .optional()
      .describe('Another property of the same event to split the numbers by, such as post'),
    ...reportFilterFields,
  }),
);

const numericSummarySchema = z.strictObject({
  events: z.int(),
  median: z.number().nullable(),
  p25: z.number().nullable(),
  p75: z.number().nullable(),
});

export const propertySummaryReportSchema = z
  .strictObject({
    name: z.string(),
    key: z.string(),
    by: z.string().nullable(),
    overall: numericSummarySchema,
    groups: z.array(numericSummarySchema.extend({ value: z.string() })),
    other_count: z.int(),
  })
  .meta({
    id: 'PropertySummaryReport',
    description:
      'The median and the 25th and 75th percentiles of one numeric property of a named event in ' +
      'the range. Only events whose property is a JSON number count; overall.events says how ' +
      'many, and the figures are null when none does. With by, groups are the ' +
      `${String(TOP_SUMMARY_GROUPS)} values of that other property carried by the most of those ` +
      'events, by events then value, each with the same figures, and other_count counts the ' +
      'events of every other value; events without it are in overall only. Without by, groups ' +
      'is empty and other_count is 0.',
  });

export type PropertySummaryQuery = z.infer<typeof propertySummaryQuerySchema>;
export type PropertySummaryReportBody = z.infer<typeof propertySummaryReportSchema>;
