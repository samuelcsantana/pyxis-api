import type postgres from 'postgres';
import type { TrackedEvent } from '../../src/domain/entities/tracked-event.entity';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleEventRepository } from '../../src/infra/repositories/drizzle-event.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const SHOP_ID = 'a3f1c2d4-5b6e-4f70-8192-a3b4c5d6e7f8';
const BLOG_ID = 'b4e2d3c5-6c7f-4081-9203-b4c5d6e7f809';

function trackedEvent(index: number, overrides: Partial<TrackedEvent> = {}): TrackedEvent {
  return {
    id: `9f1c2b3a-1d2e-4f5a-8b6c-${String(index).padStart(12, '0')}`,
    projectId: SHOP_ID,
    name: 'page_view',
    occurredAt: new Date('2026-10-06T14:00:05.000Z'),
    receivedAt: new Date('2026-10-06T14:00:10.000Z'),
    sessionId: '0b7e1c2d-3f4a-4b5c-9d6e-7f8a9b0c1d2e',
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

describe('DrizzleEventRepository against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let repository: DrizzleEventRepository;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    repository = new DrizzleEventRepository(createDrizzleDatabase(app));
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
    await owner`
      INSERT INTO projects (id, name) VALUES (${SHOP_ID}, 'Shop'), (${BLOG_ID}, 'Blog')
    `;
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it('inserts every new event in one statement and reports how many rows it wrote', async () => {
    expect(await repository.insertMany([trackedEvent(1), trackedEvent(2)])).toEqual({
      inserted: 2,
    });
  });

  it('skips the events of a project it already holds, by project and event id', async () => {
    await repository.insertMany([trackedEvent(1)]);

    const result = await repository.insertMany([trackedEvent(1), trackedEvent(2)]);

    expect(result).toEqual({ inserted: 1 });
    const [row] = await owner<{ count: string }[]>`SELECT count(*) FROM events`;
    expect(row?.count).toBe('2');
  });

  it('keeps the same event id in two projects apart', async () => {
    await repository.insertMany([trackedEvent(1)]);

    expect(await repository.insertMany([trackedEvent(1, { projectId: BLOG_ID })])).toEqual({
      inserted: 1,
    });
  });

  it('writes nothing for an empty list', async () => {
    expect(await repository.insertMany([])).toEqual({ inserted: 0 });
  });

  it('stores the attribution flat and the properties as JSON', async () => {
    await repository.insertMany([
      trackedEvent(1, {
        channel: 'paid',
        userId: 'user_42',
        attribution: {
          referrerHost: 'google.com',
          utmSource: 'google',
          utmMedium: 'cpc',
          utmCampaign: 'launch',
          fromAdClick: true,
        },
        properties: { plan: 'pro', seats: 3, trial: true },
      }),
    ]);

    const [row] = await owner<Record<string, unknown>[]>`
      SELECT user_id, referrer_host, utm_source, utm_medium, utm_campaign, from_ad_click, channel,
             device_type, browser, os, country, properties
      FROM events
    `;
    expect(row).toEqual({
      user_id: 'user_42',
      referrer_host: 'google.com',
      utm_source: 'google',
      utm_medium: 'cpc',
      utm_campaign: 'launch',
      from_ad_click: true,
      channel: 'paid',
      device_type: 'mobile',
      browser: 'safari',
      os: 'ios',
      country: 'BR',
      properties: { plan: 'pro', seats: 3, trial: true },
    });
  });

  it('has no column that could hold a user agent or an address', async () => {
    const columns = await owner<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'events'
    `;

    expect(
      columns
        .map(({ column_name }) => column_name)
        .filter((name) => /agent|address|ip/i.test(name)),
    ).toEqual([]);
  });
});
