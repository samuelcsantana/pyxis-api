import { z } from 'zod';
import {
  BROWSER_FAMILIES,
  CHANNELS,
  DEVICE_TYPES,
  OS_FAMILIES,
} from '../../../domain/entities/tracked-event.entity';
import { COUNTRY_CODE_PATTERN } from '../../../domain/events/country';
import {
  EVENT_NAME_PATTERN,
  MAX_PATH_LENGTH,
  MAX_PROPERTY_STRING_LENGTH,
  MAX_REFERRER_HOST_LENGTH,
  MAX_ROUTE_LENGTH,
  MAX_UTM_VALUE_LENGTH,
  PROPERTY_KEY_PATTERN,
  USER_ID_PATTERN,
} from '../../../domain/events/event-limits';
import { REGION_CODE_PATTERN } from '../../../domain/events/region';
import { API_REQUEST_METHODS } from '../../../domain/events/reserved-event-names';
import { TOP_REGIONS } from '../../../domain/queries/devices';
import { FEATURE_KINDS } from '../../../domain/queries/features';
import { FUNNEL_MODES, MAX_FUNNEL_STEPS, MIN_FUNNEL_STEPS } from '../../../domain/queries/funnel';
import {
  MAX_VISIT_PATH_FILTERS,
  VISIT_IDENTITIES,
  type VisitPropertyFilter,
} from '../../../domain/queries/report-filters';
import { REQUEST_KINDS, STATUS_CLASSES } from '../../../domain/queries/requests';
import type { VisitRouteFilter } from '../../../domain/queries/visits';

const MAX_SCREEN_LENGTH = 256;
const ROUTE_SEPARATOR = ' ';
const PROPERTY_SEPARATOR = '=';
const FAILED_VALUES = ['true', 'false'] as const;

const pathFilterSchema = z.string().startsWith('/').max(MAX_PATH_LENGTH);

const pathFiltersSchema = z
  .union([pathFilterSchema, z.array(pathFilterSchema).max(MAX_VISIT_PATH_FILTERS)])
  .transform((paths) => (typeof paths === 'string' ? [paths] : paths));

const propertyFilterSchema = z.string().transform((text, context): VisitPropertyFilter => {
  const separator = text.indexOf(PROPERTY_SEPARATOR);
  const key = text.slice(0, separator);
  const value = text.slice(separator + 1);
  if (
    separator < 0 ||
    !PROPERTY_KEY_PATTERN.test(key) ||
    value.length === 0 ||
    value.length > MAX_PROPERTY_STRING_LENGTH
  ) {
    context.addIssue({ code: 'custom', message: 'property must be key=value' });
    return z.NEVER;
  }
  return { key, value };
});

export const reportFilterFields = {
  path: pathFiltersSchema.optional(),
  event: z.string().regex(EVENT_NAME_PATTERN).optional(),
  property: propertyFilterSchema.optional(),
  channel: z.enum(CHANNELS).optional(),
  device: z.enum(DEVICE_TYPES).optional(),
  browser: z.enum(BROWSER_FAMILIES).optional(),
  os: z.enum(OS_FAMILIES).optional(),
  identity: z.enum(VISIT_IDENTITIES).optional(),
  country: z.string().regex(COUNTRY_CODE_PATTERN).optional(),
  region: z.string().regex(REGION_CODE_PATTERN).optional(),
  source: z.string().min(1).max(MAX_REFERRER_HOST_LENGTH).optional(),
  campaign: z.string().min(1).max(MAX_UTM_VALUE_LENGTH).optional(),
  failed: z
    .enum(FAILED_VALUES)
    .transform((value) => value === 'true')
    .optional(),
};

export type ReportFilterParams = z.output<z.ZodObject<typeof reportFilterFields>>;

type EventAndProperty = Pick<ReportFilterParams, 'event' | 'property'>;

export function propertyNeedsEvent<Schema extends z.ZodType<EventAndProperty>>(
  schema: Schema,
): Schema {
  return schema.refine((query) => query.property === undefined || query.event !== undefined, {
    message: 'property needs an event',
    path: ['property'],
  });
}

const routePartsSchema = z.strictObject({
  method: z.enum(API_REQUEST_METHODS),
  route: z.string().min(1).max(MAX_ROUTE_LENGTH).startsWith('/'),
});

export const routeFilterSchema = z.string().transform((text, context): VisitRouteFilter => {
  const separator = text.indexOf(ROUTE_SEPARATOR);
  const parts = routePartsSchema.safeParse({
    method: text.slice(0, separator),
    route: text.slice(separator + 1),
  });
  if (!parts.success) {
    context.addIssue({
      code: 'custom',
      message: 'route must be a method and a route, like POST /orders',
    });
    return z.NEVER;
  }
  return parts.data;
});

export const reportTimezoneSchema = z
  .string()
  .describe(
    'The IANA time zone of the project, such as America/Sao_Paulo: every time in this answer ' +
      'is a UTC instant, to be shown in this zone',
  );

export const rangeQuerySchema = z.strictObject({
  from: z.iso.date().describe('First day, inclusive, in the project time zone'),
  to: z.iso.date().describe('Last day, inclusive, at most today in the project time zone'),
});

export const filteredRangeQuerySchema = propertyNeedsEvent(
  rangeQuerySchema.extend(reportFilterFields),
);

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
      converting_visits: kpiSchema
        .nullable()
        .describe('Visits that sent the conversion event at least once; null without one'),
      write_errors: z.strictObject({
        current: failureCountSchema,
        previous: failureCountSchema,
        daily: z.array(failureCountSchema),
      }),
    }),
    days: z.array(z.strictObject({ date: z.iso.date(), page_views: z.int(), events: z.int() })),
    top_pages: z.array(z.strictObject({ path: z.string(), views: z.int(), visits: z.int() })),
    top_events: z.array(z.strictObject({ name: z.string(), count: z.int(), visits: z.int() })),
    comparison_cutoff: z.iso
      .time({ precision: 3 })
      .nullable()
      .describe(
        'When the range ends today in the project time zone: the local time it was read at, ' +
          'and the previous period stops at that time on its last day. Null when the range is ' +
          'over and both periods are whole days.',
      ),
    previous_days: z
      .array(
        z.strictObject({
          date: z.iso.date(),
          page_views: z.int(),
          events: z.int(),
          visits: z.int(),
          identified_users: z.int(),
          conversions: z.int().nullable(),
          converting_visits: z.int().nullable(),
          write_errors: failureCountSchema,
        }),
      )
      .describe('One entry per day of the previous period, oldest first'),
  })
  .meta({
    id: 'OverviewReport',
    description:
      'Visits, identified users, conversions (null without a conversion event) and failed writes ' +
      'of the range against the previous one (the same number of days right before it), with ' +
      'one daily entry per day of each period.',
  });

const valueSharesSchema = z.array(
  z.strictObject({
    value: z.string(),
    visits: z.int(),
    conversions: z.int().nullable(),
    converting_visits: z.int().nullable(),
  }),
);

const regionSharesSchema = z.array(
  z.strictObject({
    value: z.string().nullable(),
    name: z.string().nullable(),
    visits: z.int(),
    conversions: z.int().nullable(),
    converting_visits: z.int().nullable(),
  }),
);

export const devicesReportSchema = z
  .strictObject({
    device_types: valueSharesSchema,
    browsers: valueSharesSchema,
    operating_systems: valueSharesSchema,
    countries: valueSharesSchema,
    regions: regionSharesSchema,
  })
  .meta({
    id: 'DevicesReport',
    description:
      'Visits, conversion events and converting visits (both null without a conversion event) ' +
      'per value, sorted by visits: the top five values and "other" for the rest, unknown ' +
      `countries included. regions lists the top ${String(TOP_REGIONS)} regions (the first ` +
      'subdivision of the country, as an ISO 3166-2 code such as BR-SP, with the name CloudFront ' +
      'gave it), then "other" for the rest, then a null value for visits without a region.',
  });

const sourceShareShape = {
  source: z.string(),
  medium: z.string().nullable(),
  channel: z.enum(CHANNELS),
  visits: z.int(),
  conversions: z.int().nullable(),
  converting_visits: z.int().nullable(),
  from_ad_click_visits: z.int(),
};

export const acquisitionReportSchema = z
  .strictObject({
    days: z.array(
      z.strictObject({ date: z.iso.date(), by_channel: z.record(z.enum(CHANNELS), z.int()) }),
    ),
    sources: z.array(z.strictObject(sourceShareShape)),
    campaigns: z.array(z.strictObject({ campaign: z.string(), ...sourceShareShape })),
  })
  .meta({
    id: 'AcquisitionReport',
    description:
      'Visits per day and channel, every channel named, the top sources and the top campaigns: ' +
      'the source is the campaign source, else the referring host, else "(ad click)" when the ' +
      'visit came from an ad click, else "(direct)", and the campaign is utm_campaign, both ' +
      'taken from the first page view of the visit that carries a channel. Visits without a ' +
      'campaign are left out of campaigns.',
  });

export const featuresQuerySchema = propertyNeedsEvent(
  rangeQuerySchema.extend({ kind: z.enum(FEATURE_KINDS), ...reportFilterFields }),
);

export const requestsQuerySchema = propertyNeedsEvent(
  rangeQuerySchema.extend({
    screen: z.string().startsWith('/').max(MAX_SCREEN_LENGTH).optional(),
    kind: z.enum(REQUEST_KINDS).default('writes'),
    route: routeFilterSchema.optional(),
    ...reportFilterFields,
  }),
);

const funnelStepSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('page'),
    path: z.string().startsWith('/').max(MAX_PATH_LENGTH),
  }),
  z.strictObject({ type: z.literal('event'), name: z.string().regex(EVENT_NAME_PATTERN) }),
]);

export const funnelStepsSchema = z
  .string()
  .transform((text, context) => {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      context.addIssue({ code: 'custom', message: 'steps must be JSON' });
      return z.NEVER;
    }
  })
  .pipe(z.array(funnelStepSchema).min(MIN_FUNNEL_STEPS).max(MAX_FUNNEL_STEPS));

export const funnelFieldsSchema = rangeQuerySchema.extend({
  mode: z.enum(FUNNEL_MODES),
  steps: funnelStepsSchema,
  ...reportFilterFields,
});

export const funnelQuerySchema = propertyNeedsEvent(funnelFieldsSchema);

export const funnelReportSchema = z
  .strictObject({
    steps: z.array(
      z.strictObject({ count: z.int(), median_seconds_from_previous: z.int().nullable() }),
    ),
    median_seconds_overall: z.int().nullable(),
  })
  .meta({
    id: 'FunnelReport',
    description:
      'How many visits (mode=visit) or identified people (mode=user) reached each step, in order: ' +
      'a step counts only at or after the first time the previous one happened. ' +
      'median_seconds_from_previous is the median time, in whole seconds, between reaching the ' +
      'previous step and this one, among those who reached it (null on the first step or when ' +
      'nobody did); median_seconds_overall the same from the first step to the last.',
  });

const timelineCursor = { before: z.iso.datetime().optional() };

export const timelineQuerySchema = z.union([
  z.strictObject({ user_id: z.string().regex(USER_ID_PATTERN), ...timelineCursor }),
  z.strictObject({ session_id: z.uuid(), ...timelineCursor }),
]);

export const timelineReportSchema = z
  .strictObject({
    visits: z.array(
      z.strictObject({
        session_id: z.uuid(),
        started_at: z.iso.datetime(),
        ended_at: z.iso.datetime(),
        device_type: z.string(),
        browser: z.string(),
        os: z.string(),
        country: z.string().nullable(),
        region: z.string().nullable(),
        region_name: z.string().nullable(),
        channel: z.enum(CHANNELS).nullable(),
        user_id: z.string().nullable(),
        events: z.array(
          z.strictObject({
            id: z.uuid(),
            occurred_at: z.iso.datetime(),
            name: z.string(),
            path: z.string(),
            properties: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
          }),
        ),
      }),
    ),
    next_before: z.iso.datetime().nullable(),
    timezone: reportTimezoneSchema,
  })
  .meta({
    id: 'TimelineReport',
    description:
      'The visits of a person (every visit with an event carrying the user id, the one they ' +
      'identified in included) or of one visit, newest first, 20 per page, with all their ' +
      'events. user_id is the first id the visit was identified with, null for an anonymous ' +
      'one. next_before is the cursor for the older page, null on the last one. Times are UTC; ' +
      'timezone names the project zone to show them in.',
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
    kind: z.enum(REQUEST_KINDS),
    routes: z.array(
      z.strictObject({
        method: z.string(),
        route: z.string(),
        total: z.int(),
        failed: z.int(),
        statuses: z.array(z.strictObject({ status: z.int(), count: z.int() })),
        median_duration_ms: z.int(),
        p95_duration_ms: z.int(),
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
    days: z.array(
      z.strictObject({
        date: z.iso.date(),
        by_status_class: z.record(z.enum(STATUS_CLASSES), z.int()),
      }),
    ),
    route_days: z
      .array(
        z.strictObject({
          date: z.iso.date(),
          total: z.int(),
          failed: z.int(),
          median_duration_ms: z.int().nullable(),
          p95_duration_ms: z.int().nullable(),
        }),
      )
      .nullable(),
    timezone: reportTimezoneSchema,
  })
  .meta({
    id: 'RequestsReport',
    description:
      'Writes (methods other than GET, kind=writes) or failed reads (GET, kind=reads) per route, ' +
      'the most failing first: a failure is status 0 or 400 and above. Reads count failures ' +
      'only, so total equals failed and no rate can be drawn from them: a site may send a GET ' +
      'only when it fails. Screens are the pages the calls were made from; at most five recent ' +
      'failures per route, newest first. days counts the calls of every route per day by status ' +
      'class (success below 400, client_error 4xx, server_error 5xx, no_response status 0). ' +
      'route_days, only when a route is asked, gives that route per day: calls, failures, and the ' +
      'median and 95th percentile duration (null on a day without calls). The days are counted ' +
      'in the project time zone, named in timezone; the failure times are UTC.',
  });

export type FilteredRangeQuery = z.infer<typeof filteredRangeQuerySchema>;
export type FeaturesQuery = z.infer<typeof featuresQuerySchema>;
export type RequestsQuery = z.infer<typeof requestsQuerySchema>;
export type FunnelQuery = z.infer<typeof funnelQuerySchema>;
export type TimelineQuery = z.infer<typeof timelineQuerySchema>;
export type TimelineReportBody = z.infer<typeof timelineReportSchema>;
export type FunnelReportBody = z.infer<typeof funnelReportSchema>;
export type FeaturesReportBody = z.infer<typeof featuresReportSchema>;
export type RequestsReportBody = z.infer<typeof requestsReportSchema>;
export type AcquisitionReportBody = z.infer<typeof acquisitionReportSchema>;
export type DevicesReportBody = z.infer<typeof devicesReportSchema>;
export type OverviewReportBody = z.infer<typeof overviewReportSchema>;
