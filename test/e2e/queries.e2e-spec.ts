import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import postgres from 'postgres';
import { sha256Hex } from '../../src/domain/auth/hashing';
import { CLOCK } from '../../src/domain/services/clock';
import { SESSION_COOKIE_NAME } from '../../src/infra/http/auth/session-cookie';
import { FixedClock } from '../../src/test-utils/fixed-clock';
import { createTestApp } from './create-test-app';
import { e2eOwnerUrl } from './e2e-database';

const NOW = new Date('2026-10-05T15:00:00.000Z');
const SHOP_ID = 'e4f5a6b7-c8d9-4ea0-8b1c-2d3e4f5a6b7c';
const FOREIGN_ID = 'f5a6b7c8-d9ea-4fb1-9c2d-3e4f5a6b7c8d';
const ADMIN_ID = 'a6b7c8d9-eafb-4c12-8d3e-4f5a6b7c8d9e';
const OTHER_ADMIN_ID = 'b7c8d9ea-fb0c-4d23-9e4f-5a6b7c8d9eaf';
const SESSION_TOKEN = 'e2e-queries-session-token';
const SESSION_ID = 'c8d9eafb-0c1d-4e34-8f5a-6b7c8d9eafb0';
const AD_SESSION_ID = 'd9eafb0c-1d2e-4f45-9a6b-7c8d9eafb0c1';

describe('dashboard queries', () => {
  let app: NestFastifyApplication;
  let owner: postgres.Sql;

  const get = (path: string, cookie: string | null = `${SESSION_COOKIE_NAME}=${SESSION_TOKEN}`) =>
    app.inject({
      method: 'GET',
      url: path,
      headers: cookie === null ? {} : { cookie },
    });

  beforeAll(async () => {
    owner = postgres(e2eOwnerUrl(), { max: 1, onnotice: () => undefined });
    await owner`
      INSERT INTO projects (id, name, allowed_origins, timezone, conversion_event)
      VALUES (${SHOP_ID}, 'Queries Shop', ${['https://shop.example.com']}, 'UTC', 'signup_completed'),
             (${FOREIGN_ID}, 'Someone else', ${['https://else.example.com']}, 'UTC', NULL)
    `;
    await owner`
      INSERT INTO admin_users (id, email)
      VALUES (${ADMIN_ID}, 'queries@example.com'), (${OTHER_ADMIN_ID}, 'other@example.com')
    `;
    await owner`
      INSERT INTO admin_project_access (admin_user_id, project_id)
      VALUES (${ADMIN_ID}, ${SHOP_ID}), (${OTHER_ADMIN_ID}, ${FOREIGN_ID})
    `;
    await owner`
      INSERT INTO admin_sessions (admin_user_id, token_hash, created_at, last_used_at)
      VALUES (${ADMIN_ID}, ${sha256Hex(SESSION_TOKEN)}, ${NOW}, ${NOW})
    `;
    await owner`
      INSERT INTO events (id, project_id, occurred_at, received_at, name, session_id, user_id, path,
                          device_type, browser, os, properties)
      VALUES
        (gen_random_uuid(), ${SHOP_ID}, '2026-10-05T10:00:00Z', ${NOW}, 'page_view', ${SESSION_ID},
         NULL, '/pricing', 'desktop', 'chrome', 'macos', '{}'),
        (gen_random_uuid(), ${SHOP_ID}, '2026-10-05T10:01:00Z', ${NOW}, 'signup_completed',
         ${SESSION_ID}, 'u-1', '/pricing', 'desktop', 'chrome', 'macos', '{}'),
        (gen_random_uuid(), ${SHOP_ID}, '2026-10-05T10:02:00Z', ${NOW}, 'api_request',
         ${SESSION_ID}, 'u-1', '/pricing', 'desktop', 'chrome', 'macos',
         '{"method":"POST","route":"/v1/plans","status":503,"duration_ms":80}'),
        (gen_random_uuid(), ${FOREIGN_ID}, '2026-10-05T10:00:00Z', ${NOW}, 'page_view',
         ${SESSION_ID}, NULL, '/', 'desktop', 'chrome', 'macos', '{}')
    `;
    await owner`
      INSERT INTO events (id, project_id, occurred_at, received_at, name, session_id, path,
                          device_type, browser, os, channel, utm_source, utm_medium, from_ad_click)
      VALUES (gen_random_uuid(), ${SHOP_ID}, '2026-09-20T10:00:00Z', ${NOW}, 'page_view',
              ${AD_SESSION_ID}, '/', 'mobile', 'safari', 'ios', 'paid', 'google', 'cpc', TRUE)
    `;
    app = await createTestApp((builder) =>
      builder.overrideProvider(CLOCK).useValue(new FixedClock(NOW)),
    );
  });

  afterAll(async () => {
    await app.close();
    await owner.end();
  });

  it('answers the overview of a project the admin may read', async () => {
    const response = await get(`/v1/projects/${SHOP_ID}/overview?from=2026-10-04&to=2026-10-05`);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      kpis: {
        visits: { current: 1, previous: 0, daily: [0, 1] },
        identified_users: { current: 1, previous: 0, daily: [0, 1] },
        conversions: { current: 1, previous: 0, daily: [0, 1] },
        converting_visits: { current: 1, previous: 0, daily: [0, 1] },
        write_errors: {
          current: { failed: 1, total: 1 },
          previous: { failed: 0, total: 0 },
          daily: [
            { failed: 0, total: 0 },
            { failed: 1, total: 1 },
          ],
        },
      },
      days: [
        { date: '2026-10-04', page_views: 0, events: 0 },
        { date: '2026-10-05', page_views: 1, events: 1 },
      ],
      top_pages: [{ path: '/pricing', views: 1, visits: 1 }],
      top_events: [{ name: 'signup_completed', count: 1, visits: 1 }],
      comparison_cutoff: '15:00:00.000',
      previous_days: ['2026-10-02', '2026-10-03'].map((date) => ({
        date,
        page_views: 0,
        events: 0,
        visits: 0,
        identified_users: 0,
        conversions: 0,
        converting_visits: 0,
        write_errors: { failed: 0, total: 0 },
      })),
    });
  });

  it('compares whole days when the range ended before today', async () => {
    const response = await get(`/v1/projects/${SHOP_ID}/overview?from=2026-10-04&to=2026-10-04`);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      comparison_cutoff: null,
      previous_days: [{ date: '2026-10-03', visits: 0 }],
    });
  });

  it('answers the devices of the project', async () => {
    const response = await get(`/v1/projects/${SHOP_ID}/devices?from=2026-10-04&to=2026-10-05`);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      device_types: [{ value: 'desktop', visits: 1, conversions: 1, converting_visits: 1 }],
      browsers: [{ value: 'chrome', visits: 1, conversions: 1, converting_visits: 1 }],
      operating_systems: [{ value: 'macos', visits: 1, conversions: 1, converting_visits: 1 }],
      countries: [{ value: 'other', visits: 1, conversions: 1, converting_visits: 1 }],
    });
  });

  it('answers the acquisition of the project, every channel named', async () => {
    const response = await get(`/v1/projects/${SHOP_ID}/acquisition?from=2026-09-20&to=2026-09-20`);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      days: [
        {
          date: '2026-09-20',
          by_channel: {
            paid: 1,
            email: 0,
            social: 0,
            campaign: 0,
            organic: 0,
            referral: 0,
            direct: 0,
          },
        },
      ],
      sources: [
        {
          source: 'google',
          medium: 'cpc',
          channel: 'paid',
          visits: 1,
          conversions: 0,
          converting_visits: 0,
          from_ad_click_visits: 1,
        },
      ],
      campaigns: [],
    });
  });

  it('answers the named events and the screens of the project', async () => {
    const events = await get(
      `/v1/projects/${SHOP_ID}/features?from=2026-10-04&to=2026-10-05&kind=events`,
    );
    const screens = await get(
      `/v1/projects/${SHOP_ID}/features?from=2026-10-04&to=2026-10-05&kind=screens`,
    );

    expect(events.json()).toEqual({
      items: [{ name: 'signup_completed', count: 1, visits: 1, daily: [0, 1] }],
    });
    expect(screens.json()).toEqual({
      items: [{ name: '/pricing', count: 1, visits: 1, daily: [0, 1] }],
    });
  });

  it('answers the failing writes per route, for every screen or one', async () => {
    const all = await get(
      `/v1/projects/${SHOP_ID}/requests?from=2026-10-05&to=2026-10-05&route=POST%20%2Fv1%2Fplans`,
    );
    const elsewhere = await get(
      `/v1/projects/${SHOP_ID}/requests?from=2026-10-05&to=2026-10-05&screen=/checkout`,
    );

    expect(all.statusCode).toBe(200);
    expect(all.json()).toEqual({
      kind: 'writes',
      routes: [
        {
          method: 'POST',
          route: '/v1/plans',
          total: 1,
          failed: 1,
          statuses: [{ status: 503, count: 1 }],
          median_duration_ms: 80,
          p95_duration_ms: 80,
          screens: [{ path: '/pricing', failed: 1 }],
          recent_failures: [
            {
              occurred_at: '2026-10-05T10:02:00.000Z',
              status: 503,
              error_code: null,
              session_id: SESSION_ID,
            },
          ],
        },
      ],
      days: [
        {
          date: '2026-10-05',
          by_status_class: { success: 0, client_error: 0, server_error: 1, no_response: 0 },
        },
      ],
      route_days: [
        { date: '2026-10-05', total: 1, failed: 1, median_duration_ms: 80, p95_duration_ms: 80 },
      ],
    });
    expect(elsewhere.json()).toEqual({
      kind: 'writes',
      routes: [],
      days: [
        {
          date: '2026-10-05',
          by_status_class: { success: 0, client_error: 0, server_error: 0, no_response: 0 },
        },
      ],
      route_days: null,
    });
  });

  it('answers the failed reads when asked, and refuses an unknown kind', async () => {
    const reads = await get(
      `/v1/projects/${SHOP_ID}/requests?from=2026-10-05&to=2026-10-05&kind=reads`,
    );
    const unknown = await get(
      `/v1/projects/${SHOP_ID}/requests?from=2026-10-05&to=2026-10-05&kind=everything`,
    );

    expect(reads.statusCode).toBe(200);
    expect(reads.json()).toMatchObject({ kind: 'reads', routes: [], route_days: null });
    expect(unknown.statusCode).toBe(400);
    expect(unknown.json()).toMatchObject({ error: 'invalid_request' });
  });

  it('answers how many visits and people went through a funnel', async () => {
    const steps = encodeURIComponent(
      JSON.stringify([
        { type: 'page', path: '/pri*' },
        { type: 'event', name: 'signup_completed' },
      ]),
    );
    const range = 'from=2026-10-04&to=2026-10-05';

    const visits = await get(`/v1/projects/${SHOP_ID}/funnel?${range}&mode=visit&steps=${steps}`);
    const people = await get(`/v1/projects/${SHOP_ID}/funnel?${range}&mode=user&steps=${steps}`);

    const timed = {
      steps: [
        { count: 1, median_seconds_from_previous: null },
        { count: 1, median_seconds_from_previous: 60 },
      ],
      median_seconds_overall: 60,
    };
    expect(visits.json()).toEqual(timed);
    expect(people.json()).toEqual(timed);
  });

  it('answers the visits that reached a funnel step, and refuses a drop at the first one', async () => {
    const steps = encodeURIComponent(
      JSON.stringify([
        { type: 'page', path: '/pri*' },
        { type: 'event', name: 'signup_completed' },
      ]),
    );
    const base = `from=2026-10-04&to=2026-10-05&mode=visit&steps=${steps}`;

    const reached = await get(
      `/v1/projects/${SHOP_ID}/funnel/subjects?${base}&step=2&outcome=reached`,
    );
    const droppedFirst = await get(
      `/v1/projects/${SHOP_ID}/funnel/subjects?${base}&step=1&outcome=dropped`,
    );

    expect(reached.json()).toEqual({
      subjects: [{ id: SESSION_ID, last_step_at: '2026-10-05T10:01:00.000Z' }],
      next_cursor: null,
    });
    expect(droppedFirst.statusCode).toBe(400);
  });

  it('answers 400 to a funnel of nine steps', async () => {
    const steps = encodeURIComponent(
      JSON.stringify(
        Array.from({ length: 9 }, () => ({ type: 'event', name: 'signup_completed' })),
      ),
    );

    const response = await get(
      `/v1/projects/${SHOP_ID}/funnel?from=2026-10-05&to=2026-10-05&mode=visit&steps=${steps}`,
    );

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'invalid_request' });
  });

  it('answers the timeline of a person with all the events of their visits', async () => {
    const response = await get(`/v1/projects/${SHOP_ID}/timeline?user_id=u-1`);

    expect(response.statusCode).toBe(200);
    const body = response.json<{
      visits: { session_id: string; user_id: string | null; events: { name: string }[] }[];
      next_before: string | null;
    }>();
    expect(body.next_before).toBeNull();
    expect(body.visits.map((visit) => [visit.session_id, visit.user_id])).toEqual([
      [SESSION_ID, 'u-1'],
    ]);
    expect(body.visits[0]?.events.map((event) => event.name)).toEqual([
      'page_view',
      'signup_completed',
      'api_request',
    ]);
  });

  it('answers an empty timeline for someone the project never saw', async () => {
    const response = await get(`/v1/projects/${SHOP_ID}/timeline?user_id=nobody`);

    expect(response.json()).toEqual({ visits: [], next_before: null });
  });

  it('answers the visits of the range, filtered by page and event, with their summary', async () => {
    const range = 'from=2026-09-01&to=2026-10-05';

    const all = await get(`/v1/projects/${SHOP_ID}/visits?${range}`);
    const filtered = await get(
      `/v1/projects/${SHOP_ID}/visits?${range}&path=%2Fpri*&path=%2Fpricing` +
        '&event=signup_completed&identity=identified&device=desktop',
    );
    const paid = await get(`/v1/projects/${SHOP_ID}/visits?${range}&channel=paid`);

    expect(all.statusCode).toBe(200);
    expect(
      all.json<{ visits: { session_id: string }[] }>().visits.map((visit) => visit.session_id),
    ).toEqual([SESSION_ID, AD_SESSION_ID]);
    expect(filtered.json()).toEqual({
      visits: [
        {
          session_id: SESSION_ID,
          started_at: '2026-10-05T10:00:00.000Z',
          ended_at: '2026-10-05T10:02:00.000Z',
          entry_path: '/pricing',
          page_views: 1,
          highlights: ['signup_completed'],
          failed_requests: 1,
          device_type: 'desktop',
          browser: 'chrome',
          os: 'macos',
          country: null,
          channel: null,
          source: null,
          campaign: null,
          user_id: 'u-1',
        },
      ],
      next_cursor: null,
      total: 1,
    });
    expect(
      paid.json<{ visits: { session_id: string }[] }>().visits.map((visit) => visit.session_id),
    ).toEqual([AD_SESSION_ID]);
  });

  it('answers the visits of one source, and those whose request to a route failed', async () => {
    const range = 'from=2026-09-01&to=2026-10-05';

    const fromGoogle = await get(`/v1/projects/${SHOP_ID}/visits?${range}&source=google`);
    const failedPlans = await get(
      `/v1/projects/${SHOP_ID}/visits?${range}&route=POST%20%2Fv1%2Fplans&failed=true`,
    );
    const badRoute = await get(`/v1/projects/${SHOP_ID}/visits?${range}&route=%2Fv1%2Fplans`);

    expect(fromGoogle.json()).toMatchObject({
      visits: [{ session_id: AD_SESSION_ID, source: 'google', campaign: null }],
      total: 1,
    });
    expect(failedPlans.json()).toMatchObject({ visits: [{ session_id: SESSION_ID }], total: 1 });
    expect(badRoute.statusCode).toBe(400);
  });

  it('answers 400 to a visits property filter without an event', async () => {
    const response = await get(
      `/v1/projects/${SHOP_ID}/visits?from=2026-10-05&to=2026-10-05&property=plan%3Dmei`,
    );

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'invalid_request' });
  });

  it('answers 400 to a timeline that names neither a person nor a visit', async () => {
    const response = await get(`/v1/projects/${SHOP_ID}/timeline`);

    expect(response.statusCode).toBe(400);
  });

  it('answers 400 to an unknown feature kind', async () => {
    const response = await get(
      `/v1/projects/${SHOP_ID}/features?from=2026-10-05&to=2026-10-05&kind=clicks`,
    );

    expect(response.statusCode).toBe(400);
  });

  it('answers 404 to the devices of a project of another admin', async () => {
    const response = await get(`/v1/projects/${FOREIGN_ID}/devices?from=2026-10-05&to=2026-10-05`);

    expect(response.statusCode).toBe(404);
  });

  it.each([
    ['a project of another admin', FOREIGN_ID],
    ['a project that does not exist', '00000000-0000-4000-8000-000000000000'],
    ['a project id that is not a UUID', 'not-a-uuid'],
  ])('answers 404 not_found to %s, the same way every time', async (_case, projectId) => {
    const response = await get(`/v1/projects/${projectId}/overview?from=2026-10-05&to=2026-10-05`);

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      status_code: 404,
      error: 'not_found',
      message: 'Nothing lives at this address.',
    });
  });

  it.each([
    ['a start after the end', 'from=2026-10-05&to=2026-10-04'],
    ['an end after today in the project zone', 'from=2026-10-05&to=2026-10-06'],
    ['more than 400 days', 'from=2025-08-31&to=2026-10-05'],
  ])('answers 400 invalid_range to %s', async (_case, query) => {
    const response = await get(`/v1/projects/${SHOP_ID}/overview?${query}`);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'invalid_range' });
  });

  it.each([
    ['a missing end', 'from=2026-10-05'],
    ['a date that is not one', 'from=2026-10-05&to=tomorrow'],
    ['an unknown parameter', 'from=2026-10-05&to=2026-10-05&tz=UTC'],
  ])('answers 400 invalid_request to %s', async (_case, query) => {
    const response = await get(`/v1/projects/${SHOP_ID}/overview?${query}`);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'invalid_request' });
  });

  it('answers the settings of the project with its live keys, never a secret one', async () => {
    const publicKey = `pyxis_pk_${'Q'.repeat(32)}`;
    const secretHash = 'b'.repeat(64);
    await owner`
      INSERT INTO project_keys (project_id, kind, public_key, secret_hash, created_at, revoked_at)
      VALUES (${SHOP_ID}, 'public', ${publicKey}, NULL, '2026-10-01T08:00:00Z', NULL),
             (${SHOP_ID}, 'public', ${`pyxis_pk_${'R'.repeat(32)}`}, NULL, '2026-09-01T08:00:00Z',
              '2026-09-15T08:00:00Z'),
             (${SHOP_ID}, 'secret', NULL, ${secretHash}, '2026-10-02T08:00:00Z', NULL)
    `;

    const response = await get(`/v1/projects/${SHOP_ID}/settings`);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: SHOP_ID,
      name: 'Queries Shop',
      timezone: 'UTC',
      conversion_event: 'signup_completed',
      allowed_origins: ['https://shop.example.com'],
      first_event_at: '2026-09-20T10:00:00.000Z',
      last_event_at: '2026-10-05T10:02:00.000Z',
      event_retention_months: 13,
      public_keys: [{ key: publicKey, created_at: '2026-10-01T08:00:00.000Z' }],
      secret_keys: [{ created_at: '2026-10-02T08:00:00.000Z' }],
    });
    expect(response.body).not.toContain(secretHash);
    expect((await get(`/v1/projects/${FOREIGN_ID}/settings`)).statusCode).toBe(404);
  });

  it('answers the visits of the range by the weekday and hour they started', async () => {
    const response = await get(`/v1/projects/${SHOP_ID}/time-of-day?from=2026-09-20&to=2026-10-05`);

    expect(response.statusCode).toBe(200);
    const { weekdays } = response.json<{
      weekdays: { weekday: number; hours: number[] }[];
    }>();
    expect(weekdays.map((day) => day.weekday)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(weekdays[0]?.hours[10]).toBe(1);
    expect(weekdays[6]?.hours[10]).toBe(1);
    expect(weekdays.flatMap((day) => day.hours).reduce((sum, visits) => sum + visits, 0)).toBe(2);
  });

  it('answers how the visits of the range entered, left and lasted', async () => {
    const response = await get(`/v1/projects/${SHOP_ID}/engagement?from=2026-09-20&to=2026-10-05`);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      visits: 2,
      single_page_visits: 2,
      median_visit_seconds: 60,
      entry_pages: [
        { path: '/', visits: 1, single_page_visits: 1 },
        { path: '/pricing', visits: 1, single_page_visits: 1 },
      ],
      exit_pages: [
        { path: '/', visits: 1 },
        { path: '/pricing', visits: 1 },
      ],
    });
  });

  it('answers a funnel per device type and per channel of the visit', async () => {
    const steps = encodeURIComponent(
      JSON.stringify([
        { type: 'page', path: '/pricing' },
        { type: 'event', name: 'signup_completed' },
      ]),
    );
    const path = `/v1/projects/${SHOP_ID}/funnel/segments?from=2026-09-20&to=2026-10-05&steps=${steps}`;

    const byDevice = await get(`${path}&by=device`);
    const byChannel = await get(`${path}&by=channel`);

    expect(byDevice.statusCode).toBe(200);
    expect(byDevice.json()).toEqual({
      by: 'device',
      segments: [{ segment: 'desktop', steps: [1, 1] }],
    });
    expect(byChannel.json()).toEqual({
      by: 'channel',
      segments: [{ segment: 'unknown', steps: [1, 1] }],
    });
    expect((await get(`${path}&by=country`)).statusCode).toBe(400);
  });

  it('answers 401 without a session', async () => {
    const response = await get(
      `/v1/projects/${SHOP_ID}/overview?from=2026-10-05&to=2026-10-05`,
      null,
    );

    expect(response.statusCode).toBe(401);
  });
});
