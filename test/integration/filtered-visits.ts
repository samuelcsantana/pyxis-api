import type postgres from 'postgres';
import type { TrackedEvent } from '../../src/domain/entities/tracked-event.entity';
import type { QueryScope } from '../../src/domain/queries/query-scope';
import { NO_REPORT_FILTERS, type ReportFilters } from '../../src/domain/queries/report-filters';
import type { DrizzleDatabase } from '../../src/infra/database/drizzle.types';
import { DrizzleEventRepository } from '../../src/infra/repositories/drizzle-event.repository';

export const FILTERED_PROJECT_ID = 'f1f1f1f1-0000-4000-8000-000000000001';
export const MOBILE_VISIT = 'f2f2f2f2-0000-4000-8000-000000000001';
export const DESKTOP_VISIT = 'f2f2f2f2-0000-4000-8000-000000000002';
export const FILTERED_DAY = '2026-10-05';

export const MOBILE_ONLY: ReportFilters = { ...NO_REPORT_FILTERS, deviceType: 'mobile' };

const IPHONE = {
  deviceType: 'mobile',
  browser: 'safari',
  os: 'ios',
  country: 'BR',
  region: 'BR-SP',
  regionName: 'São Paulo',
} as const;

export const ON_A_LAPTOP = {
  deviceType: 'desktop',
  browser: 'chrome',
  os: 'windows',
  country: 'PT',
  region: 'PT-11',
  regionName: 'Lisboa',
} as const;

let sequence = 0;

export function filteredEvent(
  sessionId: string,
  occurredAt: string,
  name: string,
  overrides: Partial<TrackedEvent> = {},
): TrackedEvent {
  sequence += 1;
  return {
    id: `f3f3f3f3-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    projectId: FILTERED_PROJECT_ID,
    name,
    occurredAt: new Date(occurredAt),
    receivedAt: new Date(occurredAt),
    sessionId,
    userId: null,
    path: '/pricing',
    attribution: null,
    channel: null,
    city: null,
    properties: {},
    ...(sessionId === DESKTOP_VISIT ? ON_A_LAPTOP : IPHONE),
    ...overrides,
  };
}

const MOBILE_AND_DESKTOP_VISITS: readonly TrackedEvent[] = [
  filteredEvent(MOBILE_VISIT, '2026-10-05T10:00:00.000Z', 'page_view', {
    channel: 'paid',
    attribution: {
      referrerHost: null,
      utmSource: 'google',
      utmMedium: 'cpc',
      utmCampaign: 'spring_sale',
      fromAdClick: true,
    },
  }),
  filteredEvent(MOBILE_VISIT, '2026-10-05T10:01:00.000Z', 'plan_selected', {
    properties: { plan: 'pro' },
  }),
  filteredEvent(MOBILE_VISIT, '2026-10-05T10:02:00.000Z', 'signup_completed'),
  filteredEvent(MOBILE_VISIT, '2026-10-05T10:03:00.000Z', 'api_request', {
    properties: { method: 'POST', route: '/v1/orders', status: 500, duration_ms: 100 },
  }),
  filteredEvent(DESKTOP_VISIT, '2026-10-05T11:00:00.000Z', 'page_view', {
    channel: 'direct',
    attribution: {
      referrerHost: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      fromAdClick: false,
    },
  }),
  filteredEvent(DESKTOP_VISIT, '2026-10-05T11:01:00.000Z', 'plan_selected', {
    properties: { plan: 'free' },
  }),
  filteredEvent(DESKTOP_VISIT, '2026-10-05T11:02:00.000Z', 'api_request', {
    properties: { method: 'POST', route: '/v1/orders', status: 201, duration_ms: 50 },
  }),
  filteredEvent(DESKTOP_VISIT, '2026-10-05T11:03:00.000Z', 'page_view', { path: '/docs' }),
  filteredEvent(DESKTOP_VISIT, '2026-10-05T11:04:00.000Z', 'identify', { userId: 'ana' }),
];

export function filteredScope(filters: Partial<ReportFilters> = {}): QueryScope {
  return {
    projectId: FILTERED_PROJECT_ID,
    timeZone: 'UTC',
    conversionEvent: 'signup_completed',
    range: { from: FILTERED_DAY, to: FILTERED_DAY },
    filters: { ...NO_REPORT_FILTERS, ...filters },
  };
}

export async function seedMobileAndDesktopVisits(
  owner: postgres.Sql,
  db: DrizzleDatabase,
  more: readonly TrackedEvent[] = [],
): Promise<void> {
  await owner`INSERT INTO projects (id, name) VALUES (${FILTERED_PROJECT_ID}, 'Filtered')`;
  await new DrizzleEventRepository(db).insertMany([...MOBILE_AND_DESKTOP_VISITS, ...more]);
}
