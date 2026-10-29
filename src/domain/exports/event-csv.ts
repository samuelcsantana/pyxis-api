import type { ExportedEvent } from './exported-event';

const COLUMNS = [
  'id',
  'occurred_at',
  'name',
  'path',
  'session_id',
  'user_id',
  'referrer_host',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'from_ad_click',
  'channel',
  'device_type',
  'browser',
  'os',
  'country',
  'region',
  'region_name',
  'city',
  'properties',
] as const;

const LINE_END = '\r\n';
const NEEDS_QUOTES = /[",\r\n]/;
const QUOTE = /"/g;
const FORMULA_START = /^[=+\-@\t\r]/;
const FORMULA_GUARD = "'";

export const EVENT_CSV_HEADER = `${COLUMNS.join(',')}${LINE_END}`;

export function csvField(value: string | null): string {
  if (value === null) {
    return '';
  }
  const safe = FORMULA_START.test(value) ? `${FORMULA_GUARD}${value}` : value;
  return NEEDS_QUOTES.test(safe) ? `"${safe.replace(QUOTE, '""')}"` : safe;
}

export function eventCsvLine(event: ExportedEvent): string {
  const fields: readonly (string | null)[] = [
    event.id,
    event.occurredAt.toISOString(),
    event.name,
    event.path,
    event.sessionId,
    event.userId,
    event.referrerHost,
    event.utmSource,
    event.utmMedium,
    event.utmCampaign,
    String(event.fromAdClick),
    event.channel,
    event.deviceType,
    event.browser,
    event.os,
    event.country,
    event.region,
    event.regionName,
    event.city,
    JSON.stringify(event.properties),
  ];
  return `${fields.map(csvField).join(',')}${LINE_END}`;
}
