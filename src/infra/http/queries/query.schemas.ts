import { z } from 'zod';
import { CHANNELS } from '../../../domain/entities/tracked-event.entity';

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

const valueSharesSchema = z.array(
  z.strictObject({ value: z.string(), visits: z.int(), conversions: z.int().nullable() }),
);

export const devicesReportSchema = z
  .strictObject({
    device_types: valueSharesSchema,
    browsers: valueSharesSchema,
    operating_systems: valueSharesSchema,
    countries: valueSharesSchema,
  })
  .meta({
    id: 'DevicesReport',
    description:
      'Visits and conversions (null without a conversion event) per value, sorted by visits: the ' +
      'top five values and "other" for the rest, unknown countries included.',
  });

export const acquisitionReportSchema = z
  .strictObject({
    days: z.array(
      z.strictObject({ date: z.iso.date(), by_channel: z.record(z.enum(CHANNELS), z.int()) }),
    ),
    sources: z.array(
      z.strictObject({
        source: z.string(),
        medium: z.string().nullable(),
        channel: z.enum(CHANNELS),
        visits: z.int(),
        conversions: z.int().nullable(),
        from_ad_click_visits: z.int(),
      }),
    ),
  })
  .meta({
    id: 'AcquisitionReport',
    description:
      'Visits per day and channel, every channel named, and the top sources: the source is the ' +
      'campaign source, else the referring host, else "(direct)", taken from the first page view ' +
      'of the visit that carries a channel.',
  });

export type RangeQuery = z.infer<typeof rangeQuerySchema>;
export type AcquisitionReportBody = z.infer<typeof acquisitionReportSchema>;
export type DevicesReportBody = z.infer<typeof devicesReportSchema>;
export type OverviewReportBody = z.infer<typeof overviewReportSchema>;
