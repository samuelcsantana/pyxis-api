import fc from 'fast-check';
import type { PropertyValue } from '../entities/tracked-event.entity';
import {
  digitRun,
  PROPERTY_PARAMETERS,
  shortEmailAddress,
} from '../../test-utils/property-testing';
import {
  ERROR_CODE_PATTERN,
  EVENT_NAME_PATTERN,
  MAX_HTTP_STATUS,
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
import { templatePath } from './path-template';
import { looksPersonal } from './pii-barrier';
import { API_REQUEST, API_REQUEST_METHODS, IDENTIFY, PAGE_VIEW } from './reserved-event-names';
import { type AcceptedEvent, type EventValidation, validateIncomingEvent } from './validate-event';

const REJECTION_REASONS = ['invalid_schema', 'reserved_rules', 'pii_user_id'];
const ACCEPTED_EVENT_FIELDS = [
  'attribution',
  'id',
  'name',
  'occurredAt',
  'path',
  'properties',
  'sessionId',
  'userId',
];
const API_REQUEST_FIELDS = ['duration_ms', 'error_code', 'method', 'route', 'status'];
const ROUTE_PROPERTY = 'route';
const UTM_FIELDS = ['source', 'medium', 'campaign'] as const;
const PROPERTIES_PREFIX = 'properties.';
const UTM_PREFIX = 'utm.';
const ENCODED_AT_SIGN = '%40';
const FIRST_OCCURRED_AT = new Date('2000-01-01T00:00:00.000Z');
const LAST_OCCURRED_AT = new Date('2099-12-31T23:59:59.999Z');
const MIN_PERSONAL_DIGITS = 10;
const MAX_DOCUMENT_DIGITS = 14;
const MAX_PATH_SEGMENTS = 6;
const LONG_NUMBER_TEXT = /^\d{10,20}$/;
const MIN_ACCEPTED_SHARE = 0.5;

interface SentEvent {
  readonly name: string;
  readonly user_id?: string;
  readonly attribution?: {
    readonly utm?: Partial<Record<(typeof UTM_FIELDS)[number], string>>;
  };
  readonly properties?: Record<string, unknown>;
}

function personalText(maxLength: number): fc.Arbitrary<string> {
  return fc.oneof(
    shortEmailAddress(maxLength),
    digitRun(MIN_PERSONAL_DIGITS, MAX_DOCUMENT_DIGITS).filter((text) => text.length <= maxLength),
  );
}

function freeText(maxLength: number): fc.Arbitrary<string> {
  return fc.oneof(
    fc.string({ unit: 'binary', minLength: 1, maxLength }),
    personalText(maxLength),
    fc.uuid(),
  );
}

const pathSegment = fc.oneof(
  fc.webSegment(),
  fc.uuid(),
  fc.stringMatching(/^\d{1,14}$/),
  shortEmailAddress(MAX_ROUTE_LENGTH),
  shortEmailAddress(MAX_ROUTE_LENGTH).map((address) => address.replaceAll('@', ENCODED_AT_SIGN)),
  fc.constant(''),
);

const path = fc
  .array(pathSegment, { minLength: 1, maxLength: MAX_PATH_SEGMENTS })
  .map((segments) => `/${segments.join('/')}`);

const propertyValue = fc.oneof(
  freeText(MAX_PROPERTY_STRING_LENGTH),
  fc.maxSafeInteger(),
  fc.double({ noNaN: true, noDefaultInfinity: true }),
  fc.boolean(),
);

const genericProperties = fc.dictionary(fc.stringMatching(PROPERTY_KEY_PATTERN), propertyValue, {
  maxKeys: MAX_PROPERTIES,
  noNullPrototype: true,
});

const apiRequestProperties = fc.record(
  {
    method: fc.constantFrom(...API_REQUEST_METHODS),
    route: path.filter((route) => route.length <= MAX_ROUTE_LENGTH),
    status: fc.integer({ min: MIN_HTTP_STATUS, max: MAX_HTTP_STATUS }),
    duration_ms: fc.integer({ min: 0, max: MAX_REQUEST_DURATION_MS }),
    error_code: fc.oneof(
      fc.stringMatching(ERROR_CODE_PATTERN),
      fc.stringMatching(LONG_NUMBER_TEXT),
    ),
  },
  { requiredKeys: ['method', 'route', 'status', 'duration_ms'] },
);

const utmValue = freeText(MAX_UTM_VALUE_LENGTH);

const attribution = fc.record(
  {
    referrer_host: fc
      .oneof(
        fc.domain(),
        fc.domain().map((host) => `www.${host}`),
      )
      .filter((host) => host.length <= MAX_REFERRER_HOST_LENGTH),
    utm: fc.record(
      { source: utmValue, medium: utmValue, campaign: utmValue },
      { requiredKeys: [] },
    ),
    from_ad_click: fc.boolean(),
  },
  { requiredKeys: ['from_ad_click'] },
);

const userId = fc.oneof(
  { arbitrary: fc.stringMatching(USER_ID_PATTERN), weight: 3 },
  { arbitrary: fc.stringMatching(LONG_NUMBER_TEXT), weight: 1 },
);

const commonFields = fc.record(
  {
    id: fc.uuid({ version: 4 }),
    occurred_at: fc
      .date({ min: FIRST_OCCURRED_AT, max: LAST_OCCURRED_AT, noInvalidDate: true })
      .map((date) => date.toISOString()),
    session_id: fc.uuid({ version: 4 }),
    user_id: userId,
    path,
    attribution,
  },
  { requiredKeys: ['id', 'occurred_at', 'session_id', 'path'] },
);

const nameAndProperties = fc.oneof(
  fc.record(
    { name: fc.stringMatching(EVENT_NAME_PATTERN), properties: genericProperties },
    { requiredKeys: ['name'] },
  ),
  fc.record({ name: fc.constant(PAGE_VIEW) }),
  fc.record({ name: fc.constant(IDENTIFY), user_id: userId }),
  fc.record({ name: fc.constant(API_REQUEST), properties: apiRequestProperties }),
  fc.record(
    {
      name: fc.constantFrom(PAGE_VIEW, IDENTIFY, API_REQUEST),
      properties: fc.oneof(genericProperties, apiRequestProperties),
    },
    { requiredKeys: ['name'] },
  ),
);

const incomingEvent: fc.Arbitrary<SentEvent> = fc
  .tuple(commonFields, nameAndProperties)
  .map(([common, specific]) => ({ ...common, ...specific }));

function acceptedOnly(
  check: (
    event: AcceptedEvent,
    sent: SentEvent,
    result: Extract<EventValidation, { ok: true }>,
  ) => void,
): (sent: SentEvent) => void {
  return (sent) => {
    const result = validateIncomingEvent(sent);
    if (result.ok) {
      check(result.event, sent, result);
    }
  };
}

function screenedValues(event: AcceptedEvent): (string | number)[] {
  const propertyValues: PropertyValue[] = Object.entries(event.properties)
    .filter(([key]) => event.name !== API_REQUEST || key !== ROUTE_PROPERTY)
    .map(([, value]) => value);
  const values = [
    ...propertyValues,
    event.attribution?.utmSource,
    event.attribution?.utmMedium,
    event.attribution?.utmCampaign,
    event.userId,
  ];
  return values.filter(
    (value): value is string | number => typeof value === 'string' || typeof value === 'number',
  );
}

describe('validateIncomingEvent, for any input', () => {
  it('never throws, and answers an accepted event or one of the known rejections', () => {
    fc.assert(
      fc.property(fc.oneof(fc.anything(), fc.jsonValue(), incomingEvent), (input) => {
        const result = validateIncomingEvent(input);

        expect(result.ok || REJECTION_REASONS.includes(result.reason)).toBe(true);
      }),
      PROPERTY_PARAMETERS,
    );
  });

  it('accepts a good share of the generated events, so the properties below are exercised', () => {
    const results = fc
      .sample(incomingEvent, PROPERTY_PARAMETERS)
      .map((sent) => validateIncomingEvent(sent));
    const acceptedShare = results.filter((result) => result.ok).length / results.length;

    expect(acceptedShare).toBeGreaterThan(MIN_ACCEPTED_SHARE);
  });

  it('keeps no property, campaign or user id value that looks personal', () => {
    fc.assert(
      fc.property(
        incomingEvent,
        acceptedOnly((event) => {
          const personal = screenedValues(event).filter((value) => looksPersonal(value) !== null);

          expect(personal).toEqual([]);
        }),
      ),
      PROPERTY_PARAMETERS,
    );
  });

  it('keeps only the fields of the domain shape, and only properties the event sent', () => {
    fc.assert(
      fc.property(
        incomingEvent,
        acceptedOnly((event, sent) => {
          const allowedKeys =
            event.name === API_REQUEST ? API_REQUEST_FIELDS : Object.keys(sent.properties ?? {});

          expect(Object.keys(event).sort()).toEqual(ACCEPTED_EVENT_FIELDS);
          expect(Object.keys(event.properties).filter((key) => !allowedKeys.includes(key))).toEqual(
            [],
          );
        }),
      ),
      PROPERTY_PARAMETERS,
    );
  });

  it('accounts for every property and campaign value it does not keep', () => {
    fc.assert(
      fc.property(
        incomingEvent,
        acceptedOnly((event, sent, { dropped }) => {
          const droppedFields = dropped.map(({ field }) => field);
          const keptCampaign = {
            source: event.attribution?.utmSource,
            medium: event.attribution?.utmMedium,
            campaign: event.attribution?.utmCampaign,
          };
          const sentCampaign = UTM_FIELDS.filter(
            (field) => sent.attribution?.utm?.[field] !== undefined,
          );
          const sentProperties = Object.keys(sent.properties ?? {});

          expect(
            sentProperties.filter(
              (key) =>
                Object.hasOwn(event.properties, key) ===
                droppedFields.includes(`${PROPERTIES_PREFIX}${key}`),
            ),
          ).toEqual([]);
          expect(
            sentCampaign.filter(
              (field) =>
                (keptCampaign[field] !== null) === droppedFields.includes(`${UTM_PREFIX}${field}`),
            ),
          ).toEqual([]);
        }),
      ),
      PROPERTY_PARAMETERS,
    );
  });

  it('stores the path, and the route of an api_request, as their own templates', () => {
    fc.assert(
      fc.property(
        incomingEvent,
        acceptedOnly((event) => {
          const route = event.name === API_REQUEST ? event.properties.route : undefined;

          expect(templatePath(event.path)).toBe(event.path);
          expect(typeof route === 'string' ? templatePath(route) : route).toBe(route);
        }),
      ),
      PROPERTY_PARAMETERS,
    );
  });
});
