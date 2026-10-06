import { z } from 'zod';
import { CHANNELS } from '../../../domain/entities/tracked-event.entity';
import { FEATURE_KINDS } from '../../../domain/queries/features';

const MAX_SCREEN_LENGTH = 256;

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

export const featuresQuerySchema = rangeQuerySchema.extend({ kind: z.enum(FEATURE_KINDS) });

export const requestsQuerySchema = rangeQuerySchema.extend({
  screen: z.string().startsWith('/').max(MAX_SCREEN_LENGTH).optional(),
});

export const featuresReportSchema = z
  .strictObject({
    items: z.array(
      z.strictObject({
        name: z.string(),
        count: z.int(),
        visits: z.int(),
        daily: z.array(z.int()),
      }),
    ),
  })
  .meta({
    id: 'FeaturesReport',
    description:
      'The 50 most used named events (kind=events) or screens by page views (kind=screens), with ' +
      'the visits they appear in and one daily count per day of the range.',
  });

export const requestsReportSchema = z
  .strictObject({
    routes: z.array(
      z.strictObject({
        method: z.string(),
        route: z.string(),
        total: z.int(),
        failed: z.int(),
        statuses: z.array(z.strictObject({ status: z.int(), count: z.int() })),
        median_duration_ms: z.int(),
        screens: z.array(z.strictObject({ path: z.string(), failed: z.int() })),
        recent_failures: z.array(
          z.strictObject({
            occurred_at: z.iso.datetime(),
            status: z.int(),
            error_code: z.string().nullable(),
            session_id: z.uuid(),
          }),
        ),
      }),
    ),
  })
  .meta({
    id: 'RequestsReport',
    description:
      'Writes (methods other than GET) per route, the most failing first: a failure is status 0 ' +
      'or 400 and above. Screens are the pages the calls were made from; at most five recent ' +
      'failures per route, newest first.',
  });

export type RangeQuery = z.infer<typeof rangeQuerySchema>;
export type FeaturesQuery = z.infer<typeof featuresQuerySchema>;
export type RequestsQuery = z.infer<typeof requestsQuerySchema>;
export type FeaturesReportBody = z.infer<typeof featuresReportSchema>;
export type RequestsReportBody = z.infer<typeof requestsReportSchema>;
export type AcquisitionReportBody = z.infer<typeof acquisitionReportSchema>;
export type DevicesReportBody = z.infer<typeof devicesReportSchema>;
export type OverviewReportBody = z.infer<typeof overviewReportSchema>;
