import { z } from 'zod';
import {
  ERROR_CODE_PATTERN,
  EVENT_NAME_PATTERN,
  HOSTNAME_PATTERN,
  MAX_HTTP_STATUS,
  MAX_PATH_LENGTH,
  MAX_PROPERTIES,
  MAX_PROPERTY_STRING_LENGTH,
  MAX_REFERRER_HOST_LENGTH,
  MAX_REQUEST_DURATION_MS,
  MAX_ROUTE_LENGTH,
  MAX_UTM_VALUE_LENGTH,
  MIN_HTTP_STATUS,
  PROPERTY_KEY_PATTERN,
  USER_ID_PATTERN,
} from './event-limits';
import { API_REQUEST_METHODS } from './reserved-event-names';

const propertyValueSchema = z.union([
  z.string().max(MAX_PROPERTY_STRING_LENGTH),
  z.number(),
  z.boolean(),
]);

export const eventPropertiesSchema = z
  .record(z.string().regex(PROPERTY_KEY_PATTERN), propertyValueSchema)
  .refine((properties) => Object.keys(properties).length <= MAX_PROPERTIES, {
    message: `At most ${String(MAX_PROPERTIES)} properties`,
  })
  .meta({ maxProperties: MAX_PROPERTIES });

const utmValueSchema = z.string().min(1).max(MAX_UTM_VALUE_LENGTH);

export const attributionSchema = z.strictObject({
  referrer_host: z.string().max(MAX_REFERRER_HOST_LENGTH).regex(HOSTNAME_PATTERN).optional(),
  utm: z
    .strictObject({
      source: utmValueSchema.optional(),
      medium: utmValueSchema.optional(),
      campaign: utmValueSchema.optional(),
    })
    .optional(),
  from_ad_click: z.boolean(),
});

const pathSchema = z.string().min(1).max(MAX_PATH_LENGTH).startsWith('/');

export const incomingEventSchema = z.strictObject({
  id: z.uuidv4(),
  name: z.string().regex(EVENT_NAME_PATTERN),
  occurred_at: z.iso.datetime({ offset: true }),
  session_id: z.uuidv4(),
  user_id: z.string().regex(USER_ID_PATTERN).optional(),
  path: pathSchema,
  attribution: attributionSchema.optional(),
  properties: eventPropertiesSchema.optional(),
});

export const apiRequestPropertiesSchema = z.strictObject({
  method: z.enum(API_REQUEST_METHODS),
  route: z.string().min(1).max(MAX_ROUTE_LENGTH).startsWith('/'),
  status: z.int().min(MIN_HTTP_STATUS).max(MAX_HTTP_STATUS),
  duration_ms: z.int().min(0).max(MAX_REQUEST_DURATION_MS),
  error_code: z.string().regex(ERROR_CODE_PATTERN).optional(),
});

export type IncomingEvent = z.infer<typeof incomingEventSchema>;
export type IncomingAttribution = z.infer<typeof attributionSchema>;
export type EventProperties = z.infer<typeof eventPropertiesSchema>;
export type ApiRequestProperties = z.infer<typeof apiRequestPropertiesSchema>;
