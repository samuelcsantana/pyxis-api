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

let sequence = 0;

function event(projectId: string, occurredAt: Date): TrackedEvent {
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
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it('deletes, as the application role, exactly what is past its time', async () => {
    const report = await new RunRetentionUseCase(retention, new FixedClock(NOW)).execute();

    expect(report).toEqual({ events: 3, sessions: 3, signInCodes: 1 });
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
  });

  it('deletes events in batches of the size it is given', async () => {
    expect(await retention.deleteEventsBefore(SHOP_ID, CUTOFF, 1)).toBe(1);
    expect(await retention.deleteEventsBefore(SHOP_ID, CUTOFF, 1)).toBe(1);
    expect(await retention.deleteEventsBefore(SHOP_ID, CUTOFF, 1)).toBe(0);
  });

  it('finds nothing more to delete the second time', async () => {
    const run = new RunRetentionUseCase(retention, new FixedClock(NOW));
    await run.execute();

    expect(await run.execute()).toEqual({ events: 0, sessions: 0, signInCodes: 0 });
  });
});
