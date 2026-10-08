import type postgres from 'postgres';
import type { TrackedEvent } from '../../src/domain/entities/tracked-event.entity';
import type { QueryScope } from '../../src/domain/queries/query-scope';
import { NO_VISIT_FILTERS, type VisitFilters } from '../../src/domain/queries/visits';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleVisitsQuery } from '../../src/infra/queries/drizzle-visits.query';
import { DrizzleEventRepository } from '../../src/infra/repositories/drizzle-event.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const SHOP_ID = 'c5d6e7f8-a9b0-4c1d-8e2f-3a4b5c6d7e8f';
const BLOG_ID = 'd6e7f8a9-b0c1-4d2e-9f3a-4b5c6d7e8f9a';

const visitId = (visit: number) => `bbbbbbbb-2222-4000-8000-${String(visit).padStart(12, '0')}`;

let sequence = 0;

function event(
  visit: number,
  occurredAt: string,
  name: string,
  overrides: Partial<TrackedEvent> = {},
): TrackedEvent {
  sequence += 1;
  return {
    id: `88888888-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    projectId: SHOP_ID,
    name,
    occurredAt: new Date(occurredAt),
    receivedAt: new Date(occurredAt),
    sessionId: visitId(visit),
    userId: null,
    path: '/',
    attribution: null,
    channel: null,
    deviceType: 'mobile',
    browser: 'safari',
    os: 'ios',
    country: 'BR',
    properties: {},
    ...overrides,
  };
}

const desktop = { deviceType: 'desktop', browser: 'chrome', os: 'windows' } as const;

const NO_ATTRIBUTION = {
  referrerHost: null,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  fromAdClick: false,
} as const;

const SEEDED: readonly TrackedEvent[] = [
  event(1, '2026-10-05T10:00:00.000Z', 'page_view', {
    path: '/calculadora-taxa-ifood',
    channel: 'paid',
    attribution: {
      ...NO_ATTRIBUTION,
      utmSource: 'google',
      utmMedium: 'cpc',
      utmCampaign: 'spring_sale',
      fromAdClick: true,
    },
  }),
  event(1, '2026-10-05T10:01:00.000Z', 'calculator_result_shown', {
    path: '/calculadora-taxa-ifood',
    properties: { calculator: 'ifood' },
  }),
  event(1, '2026-10-05T10:03:00.000Z', 'page_view', { path: '/calculadora-taxa-99food' }),
  event(1, '2026-10-05T10:04:00.000Z', 'calculator_result_shown', {
    path: '/calculadora-taxa-99food',
    properties: { calculator: '99food' },
  }),
  event(1, '2026-10-05T10:05:00.000Z', 'cta_clicked', { path: '/calculadora-taxa-99food' }),
  event(1, '2026-10-05T10:06:00.000Z', 'api_request', {
    path: '/calculadora-taxa-99food',
    properties: { method: 'GET', route: '/v1/fees', status: 0, duration_ms: 9000 },
  }),
  event(2, '2026-10-05T09:00:00.000Z', 'page_view', {
    path: '/calculadora-taxa-ifood',
    ...desktop,
  }),
  event(2, '2026-10-05T09:01:00.000Z', 'calculator_result_shown', {
    path: '/calculadora-taxa-ifood',
    properties: { calculator: 'ifood' },
    ...desktop,
  }),
  event(2, '2026-10-05T09:02:00.000Z', 'identify', { userId: 'ana', ...desktop }),
  event(2, '2026-10-05T09:03:00.000Z', 'signup_completed', { userId: 'ana', ...desktop }),
  event(2, '2026-10-05T09:04:00.000Z', 'api_request', {
    userId: 'ana',
    properties: { method: 'POST', route: '/v1/orders', status: 409, duration_ms: 120 },
    ...desktop,
  }),
  event(2, '2026-10-05T09:05:00.000Z', 'api_request', {
    userId: 'ana',
    properties: { method: 'POST', route: '/v1/orders', status: 201, duration_ms: 130 },
    ...desktop,
  }),
  event(3, '2026-10-04T08:00:00.000Z', 'page_view', {
    path: '/pricing',
    channel: 'direct',
    attribution: NO_ATTRIBUTION,
    ...desktop,
  }),
  ...['e_one', 'e_two', 'e_three', 'e_four', 'e_five', 'e_six'].map((name, index) =>
    event(3, `2026-10-04T08:0${String(index + 1)}:00.000Z`, name, desktop),
  ),
  event(4, '2026-10-04T08:00:00.000Z', 'page_view', { path: '/blog/post', country: 'PT' }),
  event(7, '2026-10-05T01:00:00.000Z', 'page_view', {
    path: '/inicio',
    channel: 'referral',
    attribution: { ...NO_ATTRIBUTION, referrerHost: 'news.example.com' },
  }),
  event(8, '2026-10-03T12:00:00.000Z', 'page_view', { path: '/checkout' }),
  event(8, '2026-10-03T12:01:00.000Z', 'api_request', {
    path: '/checkout',
    properties: { method: 'POST', route: '/v1/orders', status: 201, duration_ms: 140 },
  }),
  event(8, '2026-10-03T12:02:00.000Z', 'api_request', {
    path: '/checkout',
    properties: { method: 'GET', route: '/v1/fees', status: 500, duration_ms: 40 },
  }),
  event(5, '2026-10-06T08:00:00.000Z', 'page_view', { path: '/calculadora-taxa-ifood' }),
  event(6, '2026-10-05T11:00:00.000Z', 'page_view', {
    path: '/calculadora-taxa-ifood',
    projectId: BLOG_ID,
  }),
];

const SCOPE: QueryScope = {
  projectId: SHOP_ID,
  timeZone: 'UTC',
  conversionEvent: 'signup_completed',
  range: { from: '2026-10-04', to: '2026-10-05' },
};

const ALL = 50;

describe('DrizzleVisitsQuery against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let query: DrizzleVisitsQuery;

  const sessions = async (filters: Partial<VisitFilters>, scope: QueryScope = SCOPE) =>
    (await query.list(scope, { ...NO_VISIT_FILTERS, ...filters }, null, ALL)).items.map(
      (visit) => visit.sessionId,
    );

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    const db = createDrizzleDatabase(app);
    query = new DrizzleVisitsQuery(db);
    await emptyIngestionTables(owner);
    await owner`
      INSERT INTO projects (id, name) VALUES (${SHOP_ID}, 'Shop'), (${BLOG_ID}, 'Blog')
    `;
    await new DrizzleEventRepository(db).insertMany(SEEDED);
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it('lists the visits of the range and project, newest first, with their summary', async () => {
    const { items: visits, total } = await query.list(SCOPE, NO_VISIT_FILTERS, null, ALL);

    expect(total).toBe(5);
    expect(visits.map((visit) => visit.sessionId)).toEqual([
      visitId(1),
      visitId(2),
      visitId(7),
      visitId(4),
      visitId(3),
    ]);
    expect(visits[0]).toEqual({
      sessionId: visitId(1),
      startedAt: new Date('2026-10-05T10:00:00.000Z'),
      endedAt: new Date('2026-10-05T10:06:00.000Z'),
      entryPath: '/calculadora-taxa-ifood',
      pageViews: 2,
      highlights: ['calculator_result_shown', 'cta_clicked'],
      failedRequests: 1,
      deviceType: 'mobile',
      browser: 'safari',
      os: 'ios',
      country: 'BR',
      channel: 'paid',
      source: 'google',
      campaign: 'spring_sale',
      userId: null,
    });
    expect(visits[1]).toMatchObject({
      highlights: ['calculator_result_shown', 'signup_completed'],
      failedRequests: 1,
      deviceType: 'desktop',
      channel: null,
      source: null,
      campaign: null,
      userId: 'ana',
    });
    expect(visits[2]).toMatchObject({ source: 'news.example.com', campaign: null });
    expect(visits[4]).toMatchObject({ source: '(direct)', campaign: null });
  });

  it('keeps the first five named events of a visit, in the order they happened', async () => {
    const {
      items: [visit],
    } = await query.list(SCOPE, { ...NO_VISIT_FILTERS, paths: ['/pricing'] }, null, ALL);

    expect(visit?.highlights).toEqual(['e_one', 'e_two', 'e_three', 'e_four', 'e_five']);
  });

  it('keeps only the visits that viewed every page asked, a star matching any characters', async () => {
    expect(
      await sessions({ paths: ['/calculadora-taxa-ifood', '/calculadora-taxa-99food'] }),
    ).toEqual([visitId(1)]);
    expect(await sessions({ paths: ['/calculadora-taxa-*'] })).toEqual([visitId(1), visitId(2)]);
    expect(await sessions({ paths: ['/calculadora-taxa_'] })).toEqual([]);
  });

  it('keeps the visits that sent an event, or an event that carried a property value', async () => {
    expect(await sessions({ event: { name: 'signup_completed', property: null } })).toEqual([
      visitId(2),
    ]);
    expect(
      await sessions({
        event: {
          name: 'calculator_result_shown',
          property: { key: 'calculator', value: '99food' },
        },
      }),
    ).toEqual([visitId(1)]);
  });

  it('filters by channel, device and whether the visit was identified', async () => {
    expect(await sessions({ channel: 'paid' })).toEqual([visitId(1)]);
    expect(await sessions({ deviceType: 'desktop' })).toEqual([visitId(2), visitId(3)]);
    expect(await sessions({ identity: 'identified' })).toEqual([visitId(2)]);
    expect(await sessions({ identity: 'anonymous' })).toEqual([
      visitId(1),
      visitId(7),
      visitId(4),
      visitId(3),
    ]);
  });

  it('pages with a cursor, breaking a tie on the start by the visit id', async () => {
    const { items: first } = await query.list(SCOPE, NO_VISIT_FILTERS, null, 4);
    const last = first.at(-1);
    const rest =
      last === undefined
        ? []
        : (
            await query.list(
              SCOPE,
              NO_VISIT_FILTERS,
              { startedAt: last.startedAt, sessionId: last.sessionId },
              4,
            )
          ).items;

    expect(first.map((visit) => visit.sessionId)).toEqual([
      visitId(1),
      visitId(2),
      visitId(7),
      visitId(4),
    ]);
    expect(rest.map((visit) => visit.sessionId)).toEqual([visitId(3)]);
  });

  it('reads the range in the project time zone', async () => {
    const october4 = { from: '2026-10-04', to: '2026-10-04' };
    const inSaoPaulo = { ...SCOPE, timeZone: 'America/Sao_Paulo', range: october4 };

    expect(await sessions({}, { ...SCOPE, range: october4 })).toEqual([visitId(4), visitId(3)]);
    expect(await sessions({}, inSaoPaulo)).toEqual([visitId(7), visitId(4), visitId(3)]);
  });

  it('filters by country, and by the entry source and campaign as Acquisition names them', async () => {
    expect(await sessions({ country: 'PT' })).toEqual([visitId(4)]);
    expect(await sessions({ source: 'google' })).toEqual([visitId(1)]);
    expect(await sessions({ source: 'news.example.com' })).toEqual([visitId(7)]);
    expect(await sessions({ source: '(direct)' })).toEqual([visitId(3)]);
    expect(await sessions({ campaign: 'spring_sale' })).toEqual([visitId(1)]);
    expect(await sessions({ campaign: 'autumn' })).toEqual([]);
  });

  it('keeps the visits with a failed request, or with a request to one route', async () => {
    const withOctober3 = { ...SCOPE, range: { from: '2026-10-03', to: '2026-10-05' } };
    const orders = { method: 'POST', route: '/v1/orders' } as const;
    const fees = { method: 'GET', route: '/v1/fees' } as const;

    expect(await sessions({ failed: true }, withOctober3)).toEqual([
      visitId(1),
      visitId(2),
      visitId(8),
    ]);
    expect(await sessions({ route: orders }, withOctober3)).toEqual([visitId(2), visitId(8)]);
    expect(await sessions({ route: orders, failed: true }, withOctober3)).toEqual([visitId(2)]);
    expect(await sessions({ route: fees, failed: true }, withOctober3)).toEqual([
      visitId(1),
      visitId(8),
    ]);
    expect(await sessions({ route: { method: 'GET', route: '/v1/orders' } }, withOctober3)).toEqual(
      [],
    );
  });

  it('counts every visit that matches the filters, whichever page is asked', async () => {
    const firstPage = await query.list(SCOPE, NO_VISIT_FILTERS, null, 2);
    const pastTheEnd = await query.list(
      SCOPE,
      NO_VISIT_FILTERS,
      { startedAt: new Date('2026-10-01T00:00:00.000Z'), sessionId: visitId(1) },
      2,
    );
    const desktopOnly = await query.list(
      SCOPE,
      { ...NO_VISIT_FILTERS, deviceType: 'desktop' },
      null,
      1,
    );
    const none = await query.list(SCOPE, { ...NO_VISIT_FILTERS, country: 'JP' }, null, ALL);

    expect([firstPage.items.length, firstPage.total]).toEqual([2, 5]);
    expect(pastTheEnd).toEqual({ items: [], total: 5 });
    expect([desktopOnly.items.length, desktopOnly.total]).toEqual([1, 2]);
    expect(none).toEqual({ items: [], total: 0 });
  });
});
