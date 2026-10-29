import type postgres from 'postgres';
import { sha256Hex } from '../../src/domain/auth/hashing';
import type { TrackedEvent } from '../../src/domain/entities/tracked-event.entity';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleEventRepository } from '../../src/infra/repositories/drizzle-event.repository';
import { DrizzleRetentionRepository } from '../../src/infra/repositories/drizzle-retention.repository';
import { FixedClock } from '../../src/test-utils/fixed-clock';
import { RunRetentionUseCase } from '../../src/usecases/retention/run-retention.usecase';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const SHOP_ID = 'a9b0c1d2-e3f4-4a5b-8c6d-7e8f9a0b1c2d';
const BLOG_ID = 'b0c1d2e3-f4a5-4b6c-9d7e-8f9a0b1c2d3e';
const NOW = new Date('2026-10-06T06:00:00.000Z');
const CUTOFF = new Date('2025-09-06T06:00:00.000Z');
const LIVE_CONNECTION = 'd1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f01';
const IDLE_CONNECTION = 'd1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f02';
const REVOKED_CONNECTION = 'd1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f03';

let sequence = 0;

function event(projectId: string, occurredAt: Date, city: string | null = null): TrackedEvent {
  sequence += 1;
  return {
    id: `f1f1f1f1-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    projectId,
    name: 'page_view',
    occurredAt,
    receivedAt: occurredAt,
    sessionId: 'f2f2f2f2-0000-4000-8000-000000000001',
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
    city,
    properties: {},
  };
}

describe('retention against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let retention: DrizzleRetentionRepository;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    retention = new DrizzleRetentionRepository(createDrizzleDatabase(app));
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
    await owner`
      INSERT INTO projects (id, name) VALUES (${SHOP_ID}, 'Shop'), (${BLOG_ID}, 'Blog')
    `;
    await new DrizzleEventRepository(createDrizzleDatabase(app)).insertMany([
      event(SHOP_ID, new Date(CUTOFF.getTime() - 1)),
      event(SHOP_ID, new Date(CUTOFF.getTime() - 86_400_000)),
      event(SHOP_ID, CUTOFF),
      event(SHOP_ID, NOW),
      event(BLOG_ID, new Date('2024-01-01T00:00:00.000Z')),
    ]);
    const [admin] = await owner<{ id: string }[]>`
      INSERT INTO admin_users (email) VALUES ('ana@example.com') RETURNING id
    `;
    const adminId = admin?.id ?? '';
    await owner`
      INSERT INTO admin_sessions (admin_user_id, token_hash, created_at, last_used_at, revoked_at)
      VALUES
        (${adminId}, ${sha256Hex('fresh')}, ${NOW}, ${NOW}, NULL),
        (${adminId}, ${sha256Hex('too-old')}, '2026-09-20T00:00:00Z', ${NOW}, NULL),
        (${adminId}, ${sha256Hex('idle')}, '2026-10-04T00:00:00Z', '2026-10-04T00:00:00Z', NULL),
        (${adminId}, ${sha256Hex('revoked')}, ${NOW}, ${NOW}, ${NOW})
    `;
    await owner`
      INSERT INTO otp_codes (email, code_hash, created_at, expires_at)
      VALUES
        ('ana@example.com', ${sha256Hex('1')}, ${NOW}, '2026-10-06T06:10:00Z'),
        ('ana@example.com', ${sha256Hex('2')}, '2026-10-05T00:00:00Z', '2026-10-05T00:10:00Z')
    `;
    await owner`
      INSERT INTO trial_cards (fingerprint, account_id, trial_started_at)
      VALUES
        ('fp_recent', 'f9f9f9f9-0000-4000-8000-000000000001', '2025-10-06T06:00:00Z'),
        ('fp_old', 'f9f9f9f9-0000-4000-8000-000000000002', '2025-10-06T05:59:59.999Z')
    `;
    await owner`
      INSERT INTO oauth_connections (id, admin_user_id, client_id, created_at, last_used_at, revoked_at)
      VALUES
        (${LIVE_CONNECTION}, ${adminId}, 'claude', ${NOW}, ${NOW}, NULL),
        (${IDLE_CONNECTION}, ${adminId}, 'claude', '2026-07-01T00:00:00Z', '2026-07-08T06:00:00Z', NULL),
        (${REVOKED_CONNECTION}, ${adminId}, 'claude', ${NOW}, ${NOW}, ${NOW})
    `;
    await owner`
      INSERT INTO oauth_connection_tokens (connection_id, kind, token_hash, created_at, expires_at, rotated_at)
      VALUES
        (${LIVE_CONNECTION}, 'access', ${sha256Hex('live-access')}, ${NOW}, '2026-10-06T07:00:00Z', NULL),
        (${LIVE_CONNECTION}, 'access', ${sha256Hex('expired-access')}, '2026-10-06T05:00:00Z', ${NOW}, NULL),
        (${LIVE_CONNECTION}, 'refresh', ${sha256Hex('live-refresh')}, ${NOW}, '2027-01-04T06:00:00Z', NULL),
        (${LIVE_CONNECTION}, 'refresh', ${sha256Hex('recently-rotated')}, '2026-09-10T00:00:00Z', '2026-12-09T00:00:00Z', '2026-09-06T06:00:00Z'),
        (${LIVE_CONNECTION}, 'refresh', ${sha256Hex('long-rotated')}, '2026-09-01T00:00:00Z', '2026-11-30T00:00:00Z', '2026-09-06T05:59:59.999Z')
    `;
    await owner`
      INSERT INTO oauth_authorization_requests (client_id, redirect_uri, code_challenge, created_at, expires_at)
      VALUES
        ('claude', 'https://claude.ai/cb', ${'c'.repeat(43)}, ${NOW}, '2026-10-06T06:10:00Z'),
        ('claude', 'https://claude.ai/cb', ${'c'.repeat(43)}, '2026-10-05T05:50:00Z', '2026-10-05T06:00:00Z'),
        ('claude', 'https://claude.ai/cb', ${'c'.repeat(43)}, '2026-10-05T05:49:59Z', '2026-10-05T05:59:59.999Z')
    `;
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it('deletes, as the application role, exactly what is past its time', async () => {
    const report = await new RunRetentionUseCase(retention, new FixedClock(NOW)).execute();

    expect(report).toEqual({
      events: 3,
      cities: 0,
      sessions: 3,
      signInCodes: 1,
      trialCards: 1,
      oauthConnections: 2,
      oauthTokens: 2,
      oauthRequests: 1,
    });
    const events = await owner<{ occurred_at: Date }[]>`
      SELECT occurred_at FROM events ORDER BY occurred_at
    `;
    expect(events.map((row) => row.occurred_at.toISOString())).toEqual([
      CUTOFF.toISOString(),
      NOW.toISOString(),
    ]);
    const sessions = await owner<{ token_hash: string }[]>`SELECT token_hash FROM admin_sessions`;
    expect(sessions).toEqual([{ token_hash: sha256Hex('fresh') }]);
    const [codes] = await owner<{ count: number }[]>`SELECT count(*)::int AS count FROM otp_codes`;
    expect(codes?.count).toBe(1);
    const cards = await owner<{ fingerprint: string }[]>`SELECT fingerprint FROM trial_cards`;
    expect(cards).toEqual([{ fingerprint: 'fp_recent' }]);
    const connections = await owner<{ id: string }[]>`SELECT id FROM oauth_connections`;
    expect(connections).toEqual([{ id: LIVE_CONNECTION }]);
    const tokens = await owner<{ token_hash: string }[]>`
      SELECT token_hash FROM oauth_connection_tokens ORDER BY created_at
    `;
    expect(tokens.map((row) => row.token_hash).sort()).toEqual(
      [sha256Hex('live-access'), sha256Hex('live-refresh'), sha256Hex('recently-rotated')].sort(),
    );
    const [requests] = await owner<{ count: number }[]>`
      SELECT count(*)::int AS count FROM oauth_authorization_requests
    `;
    expect(requests?.count).toBe(2);
  });

  it("keeps the old events of a held project and of a held account's projects", async () => {
    const accountId = 'c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f';
    const [admin] = await owner<{ id: string }[]>`SELECT id FROM admin_users LIMIT 1`;
    await owner`
      INSERT INTO accounts (id, owner_admin_id, status, deletion_held_at)
      VALUES (${accountId}, ${admin?.id ?? ''}, 'ended', ${NOW})
    `;
    await owner`UPDATE projects SET deletion_held_at = ${NOW} WHERE id = ${SHOP_ID}`;
    await owner`UPDATE projects SET account_id = ${accountId} WHERE id = ${BLOG_ID}`;

    expect(await retention.projectIdsNotHeld()).toEqual([]);
    const report = await new RunRetentionUseCase(retention, new FixedClock(NOW)).execute();

    expect(report.events).toBe(0);
    const [kept] = await owner<{ count: number }[]>`SELECT count(*)::int AS count FROM events`;
    expect(kept?.count).toBe(5);
  });

  it('erases, as the application role, the cities of a project with the option off only', async () => {
    await owner`UPDATE projects SET city_enabled = true WHERE id = ${BLOG_ID}`;
    await new DrizzleEventRepository(createDrizzleDatabase(app)).insertMany([
      event(SHOP_ID, NOW, 'Salvador'),
      event(SHOP_ID, NOW, 'Camaçari'),
      event(BLOG_ID, NOW, 'Lisboa'),
    ]);

    expect(await retention.projectIdsWithCitiesToErase()).toEqual([SHOP_ID]);
    const report = await new RunRetentionUseCase(retention, new FixedClock(NOW)).execute();

    expect(report.cities).toBe(2);
    const cities = await owner<{ project_id: string; city: string | null }[]>`
      SELECT project_id, city FROM events WHERE city IS NOT NULL
    `;
    expect(cities).toEqual([{ project_id: BLOG_ID, city: 'Lisboa' }]);
    expect(await retention.projectIdsWithCitiesToErase()).toEqual([]);
  });

  it('erases cities in batches, and nothing once the project turns the option back on', async () => {
    await new DrizzleEventRepository(createDrizzleDatabase(app)).insertMany([
      event(SHOP_ID, NOW, 'Salvador'),
      event(SHOP_ID, NOW, 'Ilhéus'),
    ]);

    expect(await retention.eraseCities(SHOP_ID, 1)).toBe(1);
    await owner`UPDATE projects SET city_enabled = true WHERE id = ${SHOP_ID}`;
    expect(await retention.eraseCities(SHOP_ID, 1)).toBe(0);
  });

  it('keeps the cities of a held project', async () => {
    await new DrizzleEventRepository(createDrizzleDatabase(app)).insertMany([
      event(SHOP_ID, NOW, 'Salvador'),
    ]);
    await owner`UPDATE projects SET deletion_held_at = ${NOW} WHERE id = ${SHOP_ID}`;

    expect(await retention.projectIdsWithCitiesToErase()).toEqual([]);
  });

  it('deletes events in batches of the size it is given', async () => {
    expect(await retention.deleteEventsBefore(SHOP_ID, CUTOFF, 1)).toBe(1);
    expect(await retention.deleteEventsBefore(SHOP_ID, CUTOFF, 1)).toBe(1);
    expect(await retention.deleteEventsBefore(SHOP_ID, CUTOFF, 1)).toBe(0);
  });

  it('finds nothing more to delete the second time', async () => {
    const run = new RunRetentionUseCase(retention, new FixedClock(NOW));
    await run.execute();

    expect(await run.execute()).toEqual({
      events: 0,
      cities: 0,
      sessions: 0,
      signInCodes: 0,
      trialCards: 0,
      oauthConnections: 0,
      oauthTokens: 0,
      oauthRequests: 0,
    });
  });
});
