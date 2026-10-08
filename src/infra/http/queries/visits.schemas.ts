import { z } from 'zod';
import { CHANNELS, DEVICE_TYPES } from '../../../domain/entities/tracked-event.entity';
import { COUNTRY_CODE_PATTERN } from '../../../domain/events/country';
import {
  EVENT_NAME_PATTERN,
  MAX_PATH_LENGTH,
  MAX_PROPERTY_STRING_LENGTH,
  MAX_REFERRER_HOST_LENGTH,
  MAX_UTM_VALUE_LENGTH,
  PROPERTY_KEY_PATTERN,
} from '../../../domain/events/event-limits';
import {
  MAX_VISIT_HIGHLIGHTS,
  MAX_VISIT_PATH_FILTERS,
  VISIT_IDENTITIES,
  VISIT_LIST_PAGE_SIZE,
  type VisitCursor,
  type VisitPropertyFilter,
} from '../../../domain/queries/visits';
import { rangeQuerySchema, routeFilterSchema } from './query.schemas';

const CURSOR_SEPARATOR = '~';
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

export function visitCursorText(cursor: VisitCursor): string {
  return `${cursor.startedAt.toISOString()}${CURSOR_SEPARATOR}${cursor.sessionId}`;
}

const cursorPartsSchema = z.tuple([z.iso.datetime(), z.uuid()]);

const cursorSchema = z.string().transform((text, context): VisitCursor => {
  const parts = cursorPartsSchema.safeParse(text.split(CURSOR_SEPARATOR));
  if (!parts.success) {
    context.addIssue({ code: 'custom', message: 'cursor must be a next_cursor' });
    return z.NEVER;
  }
  const [startedAt, sessionId] = parts.data;
  return { startedAt: new Date(startedAt), sessionId };
});

export const visitsQuerySchema = rangeQuerySchema
  .extend({
    path: pathFiltersSchema.optional(),
    event: z.string().regex(EVENT_NAME_PATTERN).optional(),
    property: propertyFilterSchema.optional(),
    channel: z.enum(CHANNELS).optional(),
    device: z.enum(DEVICE_TYPES).optional(),
    identity: z.enum(VISIT_IDENTITIES).optional(),
    country: z.string().regex(COUNTRY_CODE_PATTERN).optional(),
    source: z.string().min(1).max(MAX_REFERRER_HOST_LENGTH).optional(),
    campaign: z.string().min(1).max(MAX_UTM_VALUE_LENGTH).optional(),
    route: routeFilterSchema.optional(),
    failed: z
      .enum(FAILED_VALUES)
      .transform((value) => value === 'true')
      .optional(),
    cursor: cursorSchema.optional(),
  })
  .refine((query) => query.property === undefined || query.event !== undefined, {
    message: 'property needs an event',
    path: ['property'],
  });

export const visitsReportSchema = z
  .strictObject({
    visits: z.array(
      z.strictObject({
        session_id: z.uuid(),
        started_at: z.iso.datetime(),
        ended_at: z.iso.datetime(),
        entry_path: z.string().nullable(),
        page_views: z.int(),
        highlights: z.array(z.string()).max(MAX_VISIT_HIGHLIGHTS),
        failed_requests: z.int(),
        device_type: z.string(),
        browser: z.string(),
        os: z.string(),
        country: z.string().nullable(),
        channel: z.enum(CHANNELS).nullable(),
        source: z.string().nullable(),
        campaign: z.string().nullable(),
        user_id: z.string().nullable(),
      }),
    ),
    next_cursor: z.string().nullable(),
    total: z.int(),
  })
  .meta({
    id: 'VisitsReport',
    description:
      `The visits with events in the range, newest first, ${String(VISIT_LIST_PAGE_SIZE)} per ` +
      'page. A visit is one browser tab; nothing links two of them. entry_path is its first page ' +
      'view, highlights its first named events in order, failed_requests its api_request events ' +
      'with status 0 or 400 and above, source and campaign those of its entry page view (the ' +
      'source as Acquisition names it), user_id the id it was identified with. total counts ' +
      'every visit that matches the filters, on every page. next_cursor goes back as cursor ' +
      'for the older page, null on the last one.',
  });

export type VisitsQueryParams = z.infer<typeof visitsQuerySchema>;
export type VisitsReportBody = z.infer<typeof visitsReportSchema>;
