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

const SEEDED: readonly TrackedEvent[] = [
  event(1, '2026-10-05T10:00:00.000Z', 'page_view', {
    path: '/calculadora-taxa-ifood',
    channel: 'paid',
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
  event(3, '2026-10-04T08:00:00.000Z', 'page_view', { path: '/pricing', ...desktop }),
  ...['e_one', 'e_two', 'e_three', 'e_four', 'e_five', 'e_six'].map((name, index) =>
    event(3, `2026-10-04T08:0${String(index + 1)}:00.000Z`, name, desktop),
  ),
  event(4, '2026-10-04T08:00:00.000Z', 'page_view', { path: '/blog/post' }),
  event(7, '2026-10-05T01:00:00.000Z', 'page_view', { path: '/inicio' }),
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

  const sessions = async (filters: Partial<VisitFilters>) =>
    (await query.list(SCOPE, { ...NO_VISIT_FILTERS, ...filters }, null, ALL)).map(
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
    const visits = await query.list(SCOPE, NO_VISIT_FILTERS, null, ALL);

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
      userId: null,
    });
    expect(visits[1]).toMatchObject({
      highlights: ['calculator_result_shown', 'signup_completed'],
      failedRequests: 1,
      deviceType: 'desktop',
      channel: null,
      userId: 'ana',
    });
  });

  it('keeps the first five named events of a visit, in the order they happened', async () => {
    const [visit] = await query.list(
      SCOPE,
      { ...NO_VISIT_FILTERS, paths: ['/pricing'] },
      null,
      ALL,
    );

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
    const first = await query.list(SCOPE, NO_VISIT_FILTERS, null, 4);
    const last = first.at(-1);
    const rest =
      last === undefined
        ? []
        : await query.list(
            SCOPE,
            NO_VISIT_FILTERS,
            { startedAt: last.startedAt, sessionId: last.sessionId },
            4,
          );

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
    const inUtc = await query.list({ ...SCOPE, range: october4 }, NO_VISIT_FILTERS, null, ALL);
    const inSaoPaulo = await query.list(
      { ...SCOPE, timeZone: 'America/Sao_Paulo', range: october4 },
      NO_VISIT_FILTERS,
      null,
      ALL,
    );

    expect(inUtc.map((visit) => visit.sessionId)).toEqual([visitId(4), visitId(3)]);
    expect(inSaoPaulo.map((visit) => visit.sessionId)).toEqual([
      visitId(7),
      visitId(4),
      visitId(3),
    ]);
  });
});
