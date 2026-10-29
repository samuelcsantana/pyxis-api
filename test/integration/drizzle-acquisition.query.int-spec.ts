import type postgres from 'postgres';
import type { Attribution, TrackedEvent } from '../../src/domain/entities/tracked-event.entity';
import type { QueryScope } from '../../src/domain/queries/query-scope';
import { NO_REPORT_FILTERS } from '../../src/domain/queries/report-filters';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleAcquisitionQuery } from '../../src/infra/queries/drizzle-acquisition.query';
import { DrizzleEventRepository } from '../../src/infra/repositories/drizzle-event.repository';
import { filteredScope, MOBILE_ONLY, seedMobileAndDesktopVisits } from './filtered-visits';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const SHOP_ID = 'c9d0e1f2-a3b4-4c5d-8e6f-7a8b9c0d1e2f';
const BLOG_ID = 'd0e1f2a3-b4c5-4d6e-9f7a-8b9c0d1e2f3a';

let sequence = 0;

function event(
  sessionNumber: number,
  occurredAt: string,
  name: string,
  overrides: Partial<TrackedEvent> = {},
): TrackedEvent {
  sequence += 1;
  return {
    id: `55555555-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    projectId: SHOP_ID,
    name,
    occurredAt: new Date(occurredAt),
    receivedAt: new Date(occurredAt),
    sessionId: `66666666-0000-4000-8000-${String(sessionNumber).padStart(12, '0')}`,
    userId: null,
    path: '/',
    attribution: null,
    channel: null,
    deviceType: 'mobile',
    browser: 'safari',
    os: 'ios',
    country: 'BR',
    region: null,
    regionName: null,
    city: null,
    properties: {},
    ...overrides,
  };
}

function attribution(overrides: Partial<Attribution>): Attribution {
  return {
    referrerHost: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    fromAdClick: false,
    ...overrides,
  };
}

const AD = attribution({ utmSource: 'google', utmMedium: 'cpc', fromAdClick: true });
const SPRING_AD = { ...AD, utmCampaign: 'spring_sale' };
const SEARCH = attribution({ referrerHost: 'duckduckgo.com', utmCampaign: 'autumn' });
const BARE_AD_CLICK = attribution({ fromAdClick: true });
const AD_CLICK_FROM_GOOGLE = attribution({ fromAdClick: true, referrerHost: 'www.google.com' });
const TAGGED_AD_CLICK = attribution({
  fromAdClick: true,
  referrerHost: 'www.google.com',
  utmSource: 'google',
});

const SEEDED: readonly TrackedEvent[] = [
  event(1, '2026-10-05T12:00:00.000Z', 'page_view', { channel: 'paid', attribution: SPRING_AD }),
  event(1, '2026-10-05T12:01:00.000Z', 'page_view', { path: '/pricing' }),
  event(1, '2026-10-05T12:02:00.000Z', 'signup_completed'),
  event(1, '2026-10-05T12:03:00.000Z', 'signup_completed'),
  event(2, '2026-10-06T02:30:00.000Z', 'page_view', { channel: 'paid', attribution: AD }),
  event(3, '2026-10-04T15:00:00.000Z', 'page_view', { channel: 'organic', attribution: SEARCH }),
  event(4, '2026-10-05T16:00:00.000Z', 'page_view', { channel: 'direct' }),
  event(4, '2026-10-05T16:05:00.000Z', 'page_view', { channel: 'organic', attribution: SEARCH }),
  event(5, '2026-10-05T17:00:00.000Z', 'page_view'),
  event(6, '2026-10-05T12:00:00.000Z', 'page_view', { channel: 'direct', projectId: BLOG_ID }),
  event(7, '2026-10-03T13:00:00.000Z', 'page_view', {
    channel: 'paid',
    attribution: BARE_AD_CLICK,
  }),
  event(8, '2026-10-03T13:30:00.000Z', 'page_view', {
    channel: 'paid',
    attribution: BARE_AD_CLICK,
  }),
  event(9, '2026-10-03T14:00:00.000Z', 'page_view', {
    channel: 'paid',
    attribution: AD_CLICK_FROM_GOOGLE,
  }),
  event(10, '2026-10-03T14:30:00.000Z', 'page_view', {
    channel: 'paid',
    attribution: TAGGED_AD_CLICK,
  }),
  event(11, '2026-10-03T15:00:00.000Z', 'page_view', { channel: 'direct' }),
];

const SCOPE: QueryScope = {
  projectId: SHOP_ID,
  timeZone: 'America/Sao_Paulo',
  conversionEvent: 'signup_completed',
  range: { from: '2026-10-04', to: '2026-10-05' },
  filters: NO_REPORT_FILTERS,
};

const OCTOBER_3: QueryScope = { ...SCOPE, range: { from: '2026-10-03', to: '2026-10-03' } };

describe('DrizzleAcquisitionQuery against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let query: DrizzleAcquisitionQuery;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    const db = createDrizzleDatabase(app);
    query = new DrizzleAcquisitionQuery(db);
    await emptyIngestionTables(owner);
    await owner`
      INSERT INTO projects (id, name) VALUES (${SHOP_ID}, 'Shop'), (${BLOG_ID}, 'Blog')
    `;
    await new DrizzleEventRepository(db).insertMany(SEEDED);
    await seedMobileAndDesktopVisits(owner, db);
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it('counts each session once, by the channel of its earliest entry and its local day', async () => {
    expect(await query.visitsByDayAndChannel(SCOPE)).toEqual([
      { date: '2026-10-04', channel: 'organic', visits: 1 },
      { date: '2026-10-05', channel: 'direct', visits: 1 },
      { date: '2026-10-05', channel: 'paid', visits: 2 },
    ]);
  });

  it('groups sessions by source, medium and channel, with conversions, converting visits and ad clicks', async () => {
    expect(await query.sources(SCOPE, 20)).toEqual([
      {
        source: 'google',
        medium: 'cpc',
        channel: 'paid',
        visits: 2,
        conversions: 2,
        convertingVisits: 1,
        fromAdClickVisits: 2,
      },
      {
        source: '(direct)',
        medium: null,
        channel: 'direct',
        visits: 1,
        conversions: 0,
        convertingVisits: 0,
        fromAdClickVisits: 0,
      },
      {
        source: 'duckduckgo.com',
        medium: null,
        channel: 'organic',
        visits: 1,
        conversions: 0,
        convertingVisits: 0,
        fromAdClickVisits: 0,
      },
    ]);
  });

  it('groups the visits that came with a campaign by campaign, source, medium and channel', async () => {
    expect(await query.campaigns(SCOPE, 20)).toEqual([
      {
        campaign: 'autumn',
        source: 'duckduckgo.com',
        medium: null,
        channel: 'organic',
        visits: 1,
        conversions: 0,
        convertingVisits: 0,
        fromAdClickVisits: 0,
      },
      {
        campaign: 'spring_sale',
        source: 'google',
        medium: 'cpc',
        channel: 'paid',
        visits: 1,
        conversions: 2,
        convertingVisits: 1,
        fromAdClickVisits: 1,
      },
    ]);
  });

  it('names an ad click that came with no source or referrer "(ad click)", else by its source or referring host', async () => {
    expect(await query.sources(OCTOBER_3, 20)).toEqual([
      {
        source: '(ad click)',
        medium: null,
        channel: 'paid',
        visits: 2,
        conversions: 0,
        convertingVisits: 0,
        fromAdClickVisits: 2,
      },
      {
        source: '(direct)',
        medium: null,
        channel: 'direct',
        visits: 1,
        conversions: 0,
        convertingVisits: 0,
        fromAdClickVisits: 0,
      },
      {
        source: 'google',
        medium: null,
        channel: 'paid',
        visits: 1,
        conversions: 0,
        convertingVisits: 0,
        fromAdClickVisits: 1,
      },
      {
        source: 'www.google.com',
        medium: null,
        channel: 'paid',
        visits: 1,
        conversions: 0,
        convertingVisits: 0,
        fromAdClickVisits: 1,
      },
    ]);
  });

  it('keeps an ad click with no source in the paid channel', async () => {
    expect(await query.visitsByDayAndChannel(OCTOBER_3)).toEqual([
      { date: '2026-10-03', channel: 'direct', visits: 1 },
      { date: '2026-10-03', channel: 'paid', visits: 4 },
    ]);
  });

  it('honors the limit', async () => {
    expect(await query.sources(SCOPE, 1)).toHaveLength(1);
    expect(await query.campaigns(SCOPE, 1)).toHaveLength(1);
  });

  it('never counts another project', async () => {
    expect(
      await query.visitsByDayAndChannel({ ...SCOPE, projectId: BLOG_ID, timeZone: 'UTC' }),
    ).toEqual([{ date: '2026-10-05', channel: 'direct', visits: 1 }]);
  });

  it('counts only the visits the filters select', async () => {
    expect(await query.visitsByDayAndChannel(filteredScope(MOBILE_ONLY))).toEqual([
      { date: '2026-10-05', channel: 'paid', visits: 1 },
    ]);
    expect(await query.sources(filteredScope(MOBILE_ONLY), 20)).toEqual([
      {
        source: 'google',
        medium: 'cpc',
        channel: 'paid',
        visits: 1,
        conversions: 1,
        convertingVisits: 1,
        fromAdClickVisits: 1,
      },
    ]);
    expect(await query.campaigns(filteredScope(MOBILE_ONLY), 20)).toMatchObject([
      { campaign: 'spring_sale', visits: 1 },
    ]);
    expect(await query.campaigns(filteredScope({ identity: 'identified' }), 20)).toEqual([]);
  });
});
