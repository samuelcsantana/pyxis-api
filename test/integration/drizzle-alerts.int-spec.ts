import type postgres from 'postgres';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleAlertRecipientsQuery } from '../../src/infra/queries/drizzle-alert-recipients.query';
import { DrizzleAdminUserRepository } from '../../src/infra/repositories/drizzle-admin-user.repository';
import { DrizzleAlertDeliveryRepository } from '../../src/infra/repositories/drizzle-alert-delivery.repository';
import { DrizzleEmailPreferencesRepository } from '../../src/infra/repositories/drizzle-email-preferences.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const SHOP_ID = 'a3f1c2d4-5b6e-4f70-8192-a3b4c5d6e7f8';
const BLOG_ID = 'b4e2d3c5-6c7f-4081-9203-b4c5d6e7f809';
const ACCOUNT_ID = 'c5f3e4d6-7d80-4192-a314-c5d6e7f8091a';
const OWNER_ID = 'd6a4f5e7-8e91-42a3-b425-d6e7f8091a2b';
const SENT_AT = new Date('2026-11-05T06:00:05.000Z');
const PAUSED_UNTIL = new Date('2026-12-01T00:00:00.000Z');
const SUSPENDED_AT = new Date('2026-11-01T00:00:00.000Z');

describe('alert storage against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let admins: DrizzleAdminUserRepository;
  let preferences: DrizzleEmailPreferencesRepository;
  let recipients: DrizzleAlertRecipientsQuery;
  let deliveries: DrizzleAlertDeliveryRepository;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    const db = createDrizzleDatabase(app);
    admins = new DrizzleAdminUserRepository(db);
    preferences = new DrizzleEmailPreferencesRepository(db);
    recipients = new DrizzleAlertRecipientsQuery(db);
    deliveries = new DrizzleAlertDeliveryRepository(db);
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
    await owner`INSERT INTO admin_users (id, email) VALUES (${OWNER_ID}, 'owner@example.com')`;
    await owner`
      INSERT INTO accounts (id, owner_admin_id, status, ingestion_paused_until, suspended_at)
      VALUES (${ACCOUNT_ID}, ${OWNER_ID}, 'free', ${PAUSED_UNTIL}, ${SUSPENDED_AT})`;
    await owner`
      INSERT INTO projects (id, name, timezone, account_id, ingestion_suspended_at)
      VALUES (${SHOP_ID}, 'Shop', 'America/Sao_Paulo', ${ACCOUNT_ID}, ${SUSPENDED_AT}),
             (${BLOG_ID}, 'Blog', 'UTC', NULL, NULL)`;
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it('lists each person of each project with the alerts they keep on, and the account state', async () => {
    const ana = await admins.grantAccess('ana@example.com', SHOP_ID);
    await admins.grantAccess('ana@example.com', BLOG_ID);
    const bruno = await admins.grantAccess('bruno@example.com', SHOP_ID);
    await admins.setEmailLanguage(bruno.id, 'de');
    await preferences.save(bruno.id, SHOP_ID, { noEventsAlert: false, conversionDropAlert: false });

    const listed = await recipients.recipients();

    expect(
      listed.map(({ project, email, emailLanguage, kinds }) => [
        project.name,
        email,
        emailLanguage,
        kinds,
      ]),
    ).toEqual([
      ['Blog', 'ana@example.com', 'en', ['no_events', 'failed_writes', 'conversion_drop']],
      ['Shop', 'ana@example.com', 'en', ['no_events', 'failed_writes', 'conversion_drop']],
      ['Shop', 'bruno@example.com', 'de', ['failed_writes']],
    ]);
    expect(listed[0]).toMatchObject({ account: null, ingestionSuspended: false });
    expect(listed[1]).toEqual({
      adminUserId: ana.id,
      email: 'ana@example.com',
      emailLanguage: 'en',
      project: expect.objectContaining({ id: SHOP_ID, timezone: 'America/Sao_Paulo' }) as object,
      account: { status: 'free', suspendedAt: SUSPENDED_AT, ingestionPausedUntil: PAUSED_UNTIL },
      ingestionSuspended: true,
      kinds: ['no_events', 'failed_writes', 'conversion_drop'],
    });
  });

  it('leaves out a person who turned every alert off', async () => {
    const ana = await admins.grantAccess('ana@example.com', BLOG_ID);
    await preferences.save(ana.id, BLOG_ID, {
      noEventsAlert: false,
      failedWritesAlert: false,
      conversionDropAlert: false,
    });

    await expect(recipients.recipients()).resolves.toEqual([]);
  });

  it('remembers a sent alert once, per project, person, kind and day', async () => {
    const ana = await admins.grantAccess('ana@example.com', SHOP_ID);
    const delivery = {
      projectId: SHOP_ID,
      adminUserId: ana.id,
      kind: 'no_events',
      day: '2026-11-05',
    } as const;

    expect(await deliveries.wasSent(delivery)).toBe(false);
    await deliveries.recordSent(delivery, SENT_AT);
    await deliveries.recordSent(delivery, new Date('2026-11-05T07:00:00.000Z'));

    expect(await deliveries.wasSent(delivery)).toBe(true);
    expect(await deliveries.wasSent({ ...delivery, day: '2026-11-06' })).toBe(false);
    expect(await deliveries.wasSent({ ...delivery, kind: 'failed_writes' })).toBe(false);
    expect(await deliveries.wasSent({ ...delivery, projectId: BLOG_ID })).toBe(false);
    const rows = await owner<{ kind: string; day: string; sent_at: Date }[]>`
      SELECT kind, day::text, sent_at FROM alert_deliveries`;
    expect(rows).toEqual([{ kind: 'no_events', day: '2026-11-05', sent_at: SENT_AT }]);
  });

  it('refuses a kind of alert it does not know', async () => {
    const ana = await admins.grantAccess('ana@example.com', SHOP_ID);

    await expect(owner`
      INSERT INTO alert_deliveries (project_id, admin_user_id, kind, day, sent_at)
      VALUES (${SHOP_ID}, ${ana.id}, 'traffic_up', '2026-11-05', ${SENT_AT})`).rejects.toThrow(
      /alert_deliveries_kind_check/,
    );
  });

  it('forgets the deliveries of a deleted project', async () => {
    const ana = await admins.grantAccess('ana@example.com', SHOP_ID);
    await deliveries.recordSent(
      { projectId: SHOP_ID, adminUserId: ana.id, kind: 'failed_writes', day: '2026-11-05' },
      SENT_AT,
    );

    await owner`DELETE FROM projects WHERE id = ${SHOP_ID}`;

    expect(await owner`SELECT 1 FROM alert_deliveries`).toHaveLength(0);
  });
});
