import { type EventValidation, validateIncomingEvent } from './validate-event';

const EVENT_ID = '9f1c2b3a-1d2e-4f5a-8b6c-7d8e9f0a1b2c';
const SESSION_ID = '0b7e1c2d-3f4a-4b5c-9d6e-7f8a9b0c1d2e';

function incoming(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: EVENT_ID,
    name: 'plan_selected',
    occurred_at: '2026-10-06T14:03:10.004Z',
    session_id: SESSION_ID,
    path: '/pricing',
    ...overrides,
  };
}

function apiRequest(properties: unknown): Record<string, unknown> {
  return incoming({ name: 'api_request', properties });
}

function accepted(result: EventValidation) {
  if (!result.ok) {
    throw new Error(`expected an accepted event, got ${result.reason}`);
  }
  return result;
}

const VALID_API_REQUEST = { method: 'POST', route: '/orders', status: 201, duration_ms: 87 };

describe('validateIncomingEvent', () => {
  describe('shape', () => {
    it('accepts a minimal custom event and maps it to the domain shape', () => {
      expect(validateIncomingEvent(incoming())).toEqual({
        ok: true,
        event: {
          id: EVENT_ID,
          name: 'plan_selected',
          occurredAt: new Date('2026-10-06T14:03:10.004Z'),
          sessionId: SESSION_ID,
          userId: null,
          path: '/pricing',
          attribution: null,
          properties: {},
        },
        dropped: [],
      });
    });

    it('reads an occurred_at given with an offset', () => {
      const result = accepted(
        validateIncomingEvent(incoming({ occurred_at: '2026-10-06T11:03:10.004-03:00' })),
      );

      expect(result.event.occurredAt).toEqual(new Date('2026-10-06T14:03:10.004Z'));
    });

    it.each([
      ['an unknown field', { extra: true }],
      ['an id that is not a UUID v4', { id: '9f1c2b3a-1d2e-1f5a-8b6c-7d8e9f0a1b2c' }],
      ['a name with capitals', { name: 'PlanSelected' }],
      ['a name starting with a digit', { name: '1st_visit' }],
      ['a name longer than 64 characters', { name: `a${'b'.repeat(64)}` }],
      ['an occurred_at without an offset', { occurred_at: '2026-10-06T14:03:10' }],
      ['a session id that is not a UUID', { session_id: 'visit-1' }],
      ['a user id with a dot', { user_id: 'ana.souza' }],
      ['a user id longer than 64 characters', { user_id: 'u'.repeat(65) }],
      ['a path without the leading slash', { path: 'pricing' }],
      ['a path longer than 256 characters', { path: `/${'a'.repeat(256)}` }],
      ['an empty path', { path: '' }],
      [
        'more than ten properties',
        {
          properties: Object.fromEntries(
            Array.from({ length: 11 }, (_, index) => [`key_${String(index)}`, index]),
          ),
        },
      ],
      ['a property key with a dash', { properties: { 'plan-name': 'pro' } }],
      ['a property string longer than 100 characters', { properties: { note: 'x'.repeat(101) } }],
      ['a property that is an object', { properties: { plan: { name: 'pro' } } }],
      [
        'attribution with an upper-case referrer',
        { attribution: { referrer_host: 'Google.com', from_ad_click: false } },
      ],
      ['attribution without from_ad_click', { attribution: { referrer_host: 'google.com' } }],
      ['an unknown utm field', { attribution: { utm: { term: 'pricing' }, from_ad_click: false } }],
    ])('rejects %s as invalid_schema', (_, overrides) => {
      expect(validateIncomingEvent(incoming(overrides))).toEqual({
        ok: false,
        reason: 'invalid_schema',
      });
    });

    it.each([null, 'event', 42, []])('rejects %j as invalid_schema', (input) => {
      expect(validateIncomingEvent(input)).toEqual({ ok: false, reason: 'invalid_schema' });
    });

    it('accepts exactly ten properties of every allowed type', () => {
      const properties = {
        a: 'text',
        b: 1.5,
        c: true,
        d: false,
        e: 0,
        f: '',
        g: 'x'.repeat(100),
        h: -3,
        i: 'ifood',
        j: 999_999_999,
      };

      expect(accepted(validateIncomingEvent(incoming({ properties }))).event.properties).toEqual(
        properties,
      );
    });
  });

  describe('reserved names', () => {
    it('accepts a page_view without properties', () => {
      expect(validateIncomingEvent(incoming({ name: 'page_view' })).ok).toBe(true);
    });

    it('rejects a page_view with properties, even empty ones', () => {
      expect(validateIncomingEvent(incoming({ name: 'page_view', properties: {} }))).toEqual({
        ok: false,
        reason: 'reserved_rules',
      });
    });

    it('accepts an identify with a user id and no properties', () => {
      const result = accepted(
        validateIncomingEvent(incoming({ name: 'identify', user_id: 'user_42' })),
      );

      expect(result.event.userId).toBe('user_42');
    });

    it('rejects an identify without a user id', () => {
      expect(validateIncomingEvent(incoming({ name: 'identify' }))).toEqual({
        ok: false,
        reason: 'reserved_rules',
      });
    });

    it('rejects an identify with properties', () => {
      expect(
        validateIncomingEvent(
          incoming({ name: 'identify', user_id: 'user_42', properties: { plan: 'pro' } }),
        ),
      ).toEqual({ ok: false, reason: 'reserved_rules' });
    });

    it('accepts an api_request and keeps its properties', () => {
      expect(
        accepted(validateIncomingEvent(apiRequest(VALID_API_REQUEST))).event.properties,
      ).toEqual(VALID_API_REQUEST);
    });

    it('keeps a valid error_code on an api_request', () => {
      const properties = { ...VALID_API_REQUEST, status: 422, error_code: 'order.invalid_total' };

      expect(accepted(validateIncomingEvent(apiRequest(properties))).event.properties).toEqual(
        properties,
      );
    });

    it('re-templates the route of an api_request on the server', () => {
      const result = accepted(
        validateIncomingEvent(apiRequest({ ...VALID_API_REQUEST, route: '/orders/1234/items/' })),
      );

      expect(result.event.properties).toMatchObject({ route: '/orders/:id/items' });
    });

    it('rejects an api_request whose route grows past 100 characters once templated', () => {
      const route = '/1'.repeat(50);

      expect(validateIncomingEvent(apiRequest({ ...VALID_API_REQUEST, route }))).toEqual({
        ok: false,
        reason: 'invalid_schema',
      });
    });

    it.each([
      ['no properties', undefined],
      ['a missing duration', { method: 'GET', route: '/orders', status: 200 }],
      ['an unknown method', { ...VALID_API_REQUEST, method: 'HEAD' }],
      ['a route without the leading slash', { ...VALID_API_REQUEST, route: 'orders' }],
      ['a status above 599', { ...VALID_API_REQUEST, status: 600 }],
      ['a negative status', { ...VALID_API_REQUEST, status: -1 }],
      ['a fractional status', { ...VALID_API_REQUEST, status: 200.5 }],
      ['a duration above ten minutes', { ...VALID_API_REQUEST, duration_ms: 600_001 }],
      ['a fractional duration', { ...VALID_API_REQUEST, duration_ms: 1.5 }],
      ['an error_code with capitals', { ...VALID_API_REQUEST, error_code: 'Order.Invalid' }],
      ['an extra property', { ...VALID_API_REQUEST, user: 'ana' }],
    ])('rejects an api_request with %s as reserved_rules', (_, properties) => {
      expect(validateIncomingEvent(apiRequest(properties))).toEqual({
        ok: false,
        reason: 'reserved_rules',
      });
    });

    it('rejects a route longer than 100 characters through the generic property limit', () => {
      const route = `/${'a'.repeat(100)}`;

      expect(validateIncomingEvent(apiRequest({ ...VALID_API_REQUEST, route }))).toEqual({
        ok: false,
        reason: 'invalid_schema',
      });
    });

    it('accepts the edges of the api_request ranges', () => {
      expect(
        validateIncomingEvent(apiRequest({ ...VALID_API_REQUEST, status: 0, duration_ms: 600_000 }))
          .ok,
      ).toBe(true);
      expect(
        validateIncomingEvent(apiRequest({ ...VALID_API_REQUEST, status: 599, duration_ms: 0 })).ok,
      ).toBe(true);
    });
  });

  describe('PII barrier', () => {
    it('rejects an event whose user id looks like a CPF', () => {
      expect(validateIncomingEvent(incoming({ user_id: '12345678909' }))).toEqual({
        ok: false,
        reason: 'pii_user_id',
      });
    });

    it('keeps an internal user id made of a short number', () => {
      expect(accepted(validateIncomingEvent(incoming({ user_id: '4821' }))).event.userId).toBe(
        '4821',
      );
    });

    it('drops a property that looks personal and keeps the rest of the event', () => {
      const result = accepted(
        validateIncomingEvent(
          incoming({
            properties: {
              contact: 'ana@example.com',
              phone: '(11) 98765-4321',
              placed_at: 1_696_600_000_000,
              order_ref: '12345678-1234-4234-8234-123456789012',
              plan: 'pro',
              trial: true,
            },
          }),
        ),
      );

      expect(result.event.properties).toEqual({
        order_ref: '12345678-1234-4234-8234-123456789012',
        plan: 'pro',
        trial: true,
      });
      expect(result.dropped).toEqual([
        { field: 'properties.contact', reason: 'email' },
        { field: 'properties.phone', reason: 'long_number' },
        { field: 'properties.placed_at', reason: 'long_number' },
      ]);
    });

    it('drops a utm value that looks personal', () => {
      const result = accepted(
        validateIncomingEvent(
          incoming({
            name: 'page_view',
            attribution: {
              utm: { source: 'newsletter', medium: 'email', campaign: 'ana@example.com' },
              from_ad_click: false,
            },
          }),
        ),
      );

      expect(result.event.attribution).toEqual({
        referrerHost: null,
        utmSource: 'newsletter',
        utmMedium: 'email',
        utmCampaign: null,
        fromAdClick: false,
      });
      expect(result.dropped).toEqual([{ field: 'utm.campaign', reason: 'email' }]);
    });
  });

  describe('normalization', () => {
    it('re-templates the path', () => {
      expect(accepted(validateIncomingEvent(incoming({ path: '/orders/1234/' }))).event.path).toBe(
        '/orders/:id',
      );
    });

    it('rejects a path that grows past 256 characters once templated', () => {
      expect(validateIncomingEvent(incoming({ path: '/1'.repeat(128) }))).toEqual({
        ok: false,
        reason: 'invalid_schema',
      });
    });

    it('maps attribution and strips www. from the referrer', () => {
      const result = accepted(
        validateIncomingEvent(
          incoming({
            name: 'page_view',
            attribution: { referrer_host: 'www.google.com.br', from_ad_click: true },
          }),
        ),
      );

      expect(result.event.attribution).toEqual({
        referrerHost: 'google.com.br',
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        fromAdClick: true,
      });
    });
  });
});
