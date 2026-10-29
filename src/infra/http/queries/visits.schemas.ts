import { z } from 'zod';
import { CHANNELS } from '../../../domain/entities/tracked-event.entity';
import {
  MAX_VISIT_HIGHLIGHTS,
  VISIT_LIST_PAGE_SIZE,
  type VisitCursor,
} from '../../../domain/queries/visits';
import {
  propertyNeedsEvent,
  rangeQuerySchema,
  reportFilterFields,
  reportTimezoneSchema,
  routeFilterSchema,
} from './query.schemas';

const CURSOR_SEPARATOR = '~';

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

export const visitsQuerySchema = propertyNeedsEvent(
  rangeQuerySchema.extend({
    ...reportFilterFields,
    route: routeFilterSchema.optional(),
    cursor: cursorSchema.optional(),
  }),
);

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
        region: z.string().nullable(),
        region_name: z.string().nullable(),
        city: z.string().nullable(),
        channel: z.enum(CHANNELS).nullable(),
        source: z.string().nullable(),
        campaign: z.string().nullable(),
        user_id: z.string().nullable(),
      }),
    ),
    next_cursor: z.string().nullable(),
    total: z.int(),
    timezone: reportTimezoneSchema,
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
      'for the older page, null on the last one. Times are UTC; timezone names the project ' +
      'zone to show them in.',
  });

export type VisitsQueryParams = z.infer<typeof visitsQuerySchema>;
export type VisitsReportBody = z.infer<typeof visitsReportSchema>;
