import type { Attribution, PropertyMap, PropertyValue } from '../entities/tracked-event.entity';
import { MAX_PATH_LENGTH, MAX_ROUTE_LENGTH } from './event-limits';
import {
  apiRequestPropertiesSchema,
  type EventProperties,
  type IncomingAttribution,
  type IncomingEvent,
  incomingEventSchema,
} from './incoming-event.schema';
import { templatePath } from './path-template';
import { looksPersonal, type PiiReason } from './pii-barrier';
import { API_REQUEST, IDENTIFY, PAGE_VIEW } from './reserved-event-names';

export type EventRejectionReason = 'invalid_schema' | 'reserved_rules' | 'pii_user_id';

export interface DroppedField {
  readonly field: string;
  readonly reason: PiiReason;
}

export interface AcceptedEvent {
  readonly id: string;
  readonly name: string;
  readonly occurredAt: Date;
  readonly sessionId: string;
  readonly userId: string | null;
  readonly path: string;
  readonly attribution: Attribution | null;
  readonly properties: PropertyMap;
}

export type EventValidation =
  | { readonly ok: true; readonly event: AcceptedEvent; readonly dropped: readonly DroppedField[] }
  | { readonly ok: false; readonly reason: EventRejectionReason };

interface Screened<T> {
  readonly value: T;
  readonly dropped: readonly DroppedField[];
}

const NO_PROPERTIES: Screened<PropertyMap> = { value: {}, dropped: [] };
const WWW_PREFIX = /^www\./;

function reject(reason: EventRejectionReason): EventValidation {
  return { ok: false, reason };
}

function screenGenericProperties(properties: EventProperties | undefined): Screened<PropertyMap> {
  const kept: Record<string, PropertyValue> = {};
  const dropped: DroppedField[] = [];
  for (const [key, value] of Object.entries(properties ?? {})) {
    const reason = typeof value === 'boolean' ? null : looksPersonal(value);
    if (reason === null) {
      kept[key] = value;
    } else {
      dropped.push({ field: `properties.${key}`, reason });
    }
  }
  return { value: kept, dropped };
}

function screenApiRequestProperties(
  properties: EventProperties | undefined,
): Screened<PropertyMap> | EventRejectionReason {
  const parsed = apiRequestPropertiesSchema.safeParse(properties);
  if (!parsed.success) {
    return 'reserved_rules';
  }
  const route = templatePath(parsed.data.route);
  if (route.length > MAX_ROUTE_LENGTH) {
    return 'invalid_schema';
  }
  const { method, status, duration_ms, error_code } = parsed.data;
  const value = { method, route, status, duration_ms };
  return { value: error_code === undefined ? value : { ...value, error_code }, dropped: [] };
}

function screenPropertiesByName(
  event: IncomingEvent,
): Screened<PropertyMap> | EventRejectionReason {
  switch (event.name) {
    case PAGE_VIEW:
      return event.properties === undefined ? NO_PROPERTIES : 'reserved_rules';
    case IDENTIFY:
      return event.user_id !== undefined && event.properties === undefined
        ? NO_PROPERTIES
        : 'reserved_rules';
    case API_REQUEST:
      return screenApiRequestProperties(event.properties);
    default:
      return screenGenericProperties(event.properties);
  }
}

function screenAttribution(
  attribution: IncomingAttribution | undefined,
): Screened<Attribution | null> {
  if (attribution === undefined) {
    return { value: null, dropped: [] };
  }
  const dropped: DroppedField[] = [];
  const screenUtm = (field: 'source' | 'medium' | 'campaign'): string | null => {
    const value = attribution.utm?.[field];
    if (value === undefined) {
      return null;
    }
    const reason = looksPersonal(value);
    if (reason === null) {
      return value;
    }
    dropped.push({ field: `utm.${field}`, reason });
    return null;
  };
  const value: Attribution = {
    referrerHost: attribution.referrer_host?.replace(WWW_PREFIX, '') ?? null,
    utmSource: screenUtm('source'),
    utmMedium: screenUtm('medium'),
    utmCampaign: screenUtm('campaign'),
    fromAdClick: attribution.from_ad_click,
  };
  return { value, dropped };
}

export function validateIncomingEvent(input: unknown): EventValidation {
  const parsed = incomingEventSchema.safeParse(input);
  if (!parsed.success) {
    return reject('invalid_schema');
  }
  const event = parsed.data;
  const properties = screenPropertiesByName(event);
  if (typeof properties === 'string') {
    return reject(properties);
  }
  if (event.user_id !== undefined && looksPersonal(event.user_id) !== null) {
    return reject('pii_user_id');
  }
  const path = templatePath(event.path);
  if (path.length > MAX_PATH_LENGTH) {
    return reject('invalid_schema');
  }
  const attribution = screenAttribution(event.attribution);
  return {
    ok: true,
    event: {
      id: event.id,
      name: event.name,
      occurredAt: new Date(event.occurred_at),
      sessionId: event.session_id,
      userId: event.user_id ?? null,
      path,
      attribution: attribution.value,
      properties: properties.value,
    },
    dropped: [...attribution.dropped, ...properties.dropped],
  };
}
