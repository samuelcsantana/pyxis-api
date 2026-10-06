import { z } from 'zod';

export const rangeQuerySchema = z.strictObject({
  from: z.iso.date().describe('First day, inclusive, in the project time zone'),
  to: z.iso.date().describe('Last day, inclusive, at most today in the project time zone'),
});

const kpiSchema = z.strictObject({
  current: z.int(),
  previous: z.int(),
  daily: z.array(z.int()),
});

const failureCountSchema = z.strictObject({ failed: z.int(), total: z.int() });

export const overviewReportSchema = z
  .strictObject({
    kpis: z.strictObject({
      visits: kpiSchema,
      identified_users: kpiSchema,
      conversions: kpiSchema.nullable(),
      write_errors: z.strictObject({
        current: failureCountSchema,
        previous: failureCountSchema,
        daily: z.array(failureCountSchema),
      }),
    }),
    days: z.array(z.strictObject({ date: z.iso.date(), page_views: z.int(), events: z.int() })),
    top_pages: z.array(z.strictObject({ path: z.string(), views: z.int(), visits: z.int() })),
    top_events: z.array(z.strictObject({ name: z.string(), count: z.int(), visits: z.int() })),
  })
  .meta({
    id: 'OverviewReport',
    description:
      'Visits, identified users, conversions (null without a conversion event) and failed writes ' +
      'of the range against the previous one, with one daily entry per day of the range.',
  });

export type RangeQuery = z.infer<typeof rangeQuerySchema>;
export type OverviewReportBody = z.infer<typeof overviewReportSchema>;
