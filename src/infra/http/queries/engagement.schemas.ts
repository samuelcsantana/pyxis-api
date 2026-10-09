import { z } from 'zod';

export const engagementReportSchema = z
  .strictObject({
    visits: z.int().describe('Visits with a page view, the same count as the overview'),
    single_page_visits: z.int().describe('Visits that viewed one page only'),
    median_visit_seconds: z
      .int()
      .nullable()
      .describe('Median time from the first to the last event of a visit; null without visits'),
    visit_lengths: z
      .array(
        z.strictObject({
          up_to_seconds: z
            .int()
            .nullable()
            .describe('Upper bound, exclusive, of the bucket; null for the last, open one'),
          visits: z.int(),
        }),
      )
      .describe('The visits by length: under 10 s, 30 s, 1 min, 3 min, 10 min, 30 min, and more'),
    entry_pages: z
      .array(
        z.strictObject({
          path: z.string(),
          visits: z.int(),
          single_page_visits: z.int().describe('Visits that started here and saw nothing else'),
        }),
      )
      .describe('The ten pages most visits started on'),
    exit_pages: z
      .array(z.strictObject({ path: z.string(), visits: z.int() }))
      .describe('The ten pages most visits ended on, by their last page view'),
  })
  .meta({
    id: 'EngagementReport',
    description:
      'How the visits of the range entered, left and lasted: entry and exit pages, single-page ' +
      'visits and visit length, from the first to the last event of each visit.',
  });

export type EngagementReportBody = z.infer<typeof engagementReportSchema>;
