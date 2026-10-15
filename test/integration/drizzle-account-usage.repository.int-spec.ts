import type postgres from 'postgres';
import type { TrackedEvent } from '../../src/domain/entities/tracked-event.entity';
import { usageMonth } from '../../src/domain/queries/project-usage';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleAccountUsageRepository } from '../../src/infra/repositories/drizzle-account-usage.repository';
import { DrizzleEventRepository } from '../../src/infra/repositories/drizzle-event.repository';
import { DrizzleProjectAccountStateRepository } from '../../src/infra/repositories/drizzle-project-account-state.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const OWNER_ID = 'e1e2e3e4-0000-4000-8000-000000000001';
const BUSY_ID = 'e1e2e3e4-0000-4000-8000-000000000011';
const QUIET_ID = 'e1e2e3e4-0000-4000-8000-000000000012';
const SHOP_ID = 'e1e2e3e4-0000-4000-8000-000000000021';
const BLOG_ID = 'e1e2e3e4-0000-4000-8000-000000000022';
const OPERATOR_ID = 'e1e2e3e4-0000-4000-8000-000000000023';
const OCTOBER = usageMonth('2026-10');
const MEASURED_AT = new Date('2026-10-14T03:00:00.000Z');
const NOVEMBER_FIRST = new Date('2026-11-01T00:00:00.000Z');

let sequence = 0;

function pageView(projectId: string, occurredAt: string): TrackedEvent {
  sequence += 1;
  const at = new Date(occurredAt);
  return {
    id: `e9e9e9e9-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    projectId,
    name: 'page_view',
    occurredAt: at,
    receivedAt: at,
    sessionId: 'e8e8e8e8-0000-4000-8000-000000000001',
    userId: null,
    path: '/',
    attribution: null,
    channel: null,
    deviceType: 'desktop',
    browser: 'chrome',
    os: 'windows',
    country: 'BR',
    region: null,
    regionName: null,
    properties: {},
  };
}

describe('account usage and the state of its projects against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let usage: DrizzleAccountUsageRepository;
  let states: DrizzleProjectAccountStateRepository;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    const db = createDrizzleDatabase(app);
    usage = new DrizzleAccountUsageRepository(db);
    states = new DrizzleProjectAccountStateRepository(db);
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
    await owner`
      INSERT INTO admin_users (id, email, email_language)
      VALUES (${OWNER_ID}, 'owner@example.com', 'pt-BR')
    `;
    await owner`
      INSERT INTO accounts (id, owner_admin_id, status, created_at)
      VALUES (${BUSY_ID}, ${OWNER_ID}, 'active', '2026-10-01T00:00:00Z'),
             (${QUIET_ID}, ${OWNER_ID}, 'comped', '2026-10-02T00:00:00Z')
    `;
    await owner`
      INSERT INTO projects (id, name, account_id)
      VALUES (${SHOP_ID}, 'Shop', ${BUSY_ID}), (${BLOG_ID}, 'Blog', ${BUSY_ID}),
             (${OPERATOR_ID}, 'Operator', NULL)
    `;
    await new DrizzleEventRepository(createDrizzleDatabase(app)).insertMany([
      pageView(SHOP_ID, '2026-10-01T00:00:00Z'),
      pageView(SHOP_ID, '2026-10-13T12:00:00Z'),
      pageView(BLOG_ID, '2026-10-31T23:59:59Z'),
      pageView(BLOG_ID, '2026-09-30T23:59:59Z'),
      pageView(BLOG_ID, '2026-11-01T00:00:00Z'),
      pageView(OPERATOR_ID, '2026-10-10T00:00:00Z'),
    ]);
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it("counts each account's events in the month across its projects, oldest account first", async () => {
    expect(await usage.measure('2026-10', OCTOBER.from, OCTOBER.to)).toEqual([
      {
        accountId: BUSY_ID,
        status: 'active',
        events: 3,
        owner: { email: 'owner@example.com', language: 'pt-BR' },
        notifiedLevel: 0,
      },
      {
        accountId: QUIET_ID,
        status: 'comped',
        events: 0,
        owner: { email: 'owner@example.com', language: 'pt-BR' },
        notifiedLevel: 0,
      },
    ]);
  });

  it('remembers the level already told for the month, and only for that month', async () => {
    await usage.record(
      '2026-10',
      [{ accountId: BUSY_ID, events: 3, ingestionPausedUntil: null }],
      MEASURED_AT,
    );
    await usage.markNotified(BUSY_ID, '2026-10', 80);
    await usage.record(
      '2026-10',
      [{ accountId: BUSY_ID, events: 4, ingestionPausedUntil: null }],
      MEASURED_AT,
    );

    const october = await usage.measure('2026-10', OCTOBER.from, OCTOBER.to);
    const november = await usage.measure(
      '2026-11',
      NOVEMBER_FIRST,
      new Date('2026-12-01T00:00:00.000Z'),
    );

    expect(october.map(({ notifiedLevel }) => notifiedLevel)).toEqual([80, 0]);
    expect(november.map(({ notifiedLevel, events }) => [notifiedLevel, events])).toEqual([
      [0, 1],
      [0, 0],
    ]);
  });

  it('records the month for each account, replacing an earlier figure, and sets or lifts its pause', async () => {
    await usage.record(
      '2026-10',
      [
        { accountId: BUSY_ID, events: 3, ingestionPausedUntil: NOVEMBER_FIRST },
        { accountId: QUIET_ID, events: 0, ingestionPausedUntil: null },
      ],
      MEASURED_AT,
    );
    const later = new Date('2026-10-15T03:00:00.000Z');
    await usage.record(
      '2026-10',
      [{ accountId: BUSY_ID, events: 4, ingestionPausedUntil: null }],
      later,
    );

    expect(await usage.recordedFor(BUSY_ID, '2026-10')).toEqual({
      month: '2026-10',
      events: 4,
      updatedAt: later,
    });
    expect(await usage.recordedFor(QUIET_ID, '2026-10')).toEqual({
      month: '2026-10',
      events: 0,
      updatedAt: MEASURED_AT,
    });
    expect(await usage.recordedFor(BUSY_ID, '2026-09')).toBeNull();
    expect((await states.stateOf(SHOP_ID)).ingestionPausedUntil).toBeNull();
  });

  it('records nothing when there is no account to record', async () => {
    await usage.record('2026-10', [], MEASURED_AT);

    const rows = await owner`SELECT account_id FROM account_usage_months`;
    expect(rows).toHaveLength(0);
  });

  it("answers a project's pause from its account, and none for the operator's projects", async () => {
    await usage.record(
      '2026-10',
      [{ accountId: BUSY_ID, events: 3, ingestionPausedUntil: NOVEMBER_FIRST }],
      MEASURED_AT,
    );

    expect(await states.stateOf(SHOP_ID)).toEqual({
      ingestionPausedUntil: NOVEMBER_FIRST,
      suspended: false,
    });
    expect((await states.stateOf(BLOG_ID)).ingestionPausedUntil).toEqual(NOVEMBER_FIRST);
    expect(await states.stateOf(OPERATOR_ID)).toEqual({
      ingestionPausedUntil: null,
      suspended: false,
    });
  });

  it("tells a project of a suspended account from the account's mark", async () => {
    await owner`
      UPDATE accounts SET suspended_at = ${MEASURED_AT}, suspension_reason = 'Forged traffic'
      WHERE id = ${BUSY_ID}
    `;

    expect(await states.stateOf(SHOP_ID)).toEqual({ ingestionPausedUntil: null, suspended: true });
    expect((await states.stateOf(OPERATOR_ID)).suspended).toBe(false);
  });

  it('removes the usage of an account with the account', async () => {
    await usage.record(
      '2026-10',
      [{ accountId: QUIET_ID, events: 0, ingestionPausedUntil: null }],
      MEASURED_AT,
    );

    await owner`DELETE FROM accounts WHERE id = ${QUIET_ID}`;

    expect(await usage.recordedFor(QUIET_ID, '2026-10')).toBeNull();
  });
});
