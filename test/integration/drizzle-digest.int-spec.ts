import type postgres from 'postgres';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleDigestRecipientsQuery } from '../../src/infra/queries/drizzle-digest-recipients.query';
import { DrizzleAdminUserRepository } from '../../src/infra/repositories/drizzle-admin-user.repository';
import { DrizzleDigestDeliveryRepository } from '../../src/infra/repositories/drizzle-digest-delivery.repository';
import { DrizzleEmailPreferencesRepository } from '../../src/infra/repositories/drizzle-email-preferences.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const SHOP_ID = 'a3f1c2d4-5b6e-4f70-8192-a3b4c5d6e7f8';
const BLOG_ID = 'b4e2d3c5-6c7f-4081-9203-b4c5d6e7f809';
const SENT_AT = new Date('2026-10-12T11:00:05.000Z');

describe('weekly digest storage against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let admins: DrizzleAdminUserRepository;
  let preferences: DrizzleEmailPreferencesRepository;
  let recipients: DrizzleDigestRecipientsQuery;
  let deliveries: DrizzleDigestDeliveryRepository;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    const db = createDrizzleDatabase(app);
    admins = new DrizzleAdminUserRepository(db);
    preferences = new DrizzleEmailPreferencesRepository(db);
    recipients = new DrizzleDigestRecipientsQuery(db);
    deliveries = new DrizzleDigestDeliveryRepository(db);
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
    await owner`
      INSERT INTO projects (id, name, timezone, conversion_event)
      VALUES (${SHOP_ID}, 'Shop', 'America/Sao_Paulo', 'signup_completed'),
             (${BLOG_ID}, 'Blog', 'UTC', NULL)
    `;
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it('lists every admin of every project who keeps the digest on, by project then e-mail', async () => {
    const ana = await admins.grantAccess('ana@example.com', SHOP_ID);
    await admins.grantAccess('ana@example.com', BLOG_ID);
    const bruno = await admins.grantAccess('bruno@example.com', SHOP_ID);
    await admins.setEmailLanguage(bruno.id, 'pt-BR');
    await preferences.save(ana.id, BLOG_ID, { weeklyDigest: false });

    const listed = await recipients.recipients();

    expect(
      listed.map(({ email, emailLanguage, project }) => [project.name, email, emailLanguage]),
    ).toEqual([
      ['Shop', 'ana@example.com', 'en'],
      ['Shop', 'bruno@example.com', 'pt-BR'],
    ]);
    expect(listed[0]).toEqual({
      adminUserId: ana.id,
      email: 'ana@example.com',
      emailLanguage: 'en',
      project: expect.objectContaining({
        id: SHOP_ID,
        timezone: 'America/Sao_Paulo',
        conversionEvent: 'signup_completed',
      }) as object,
    });
  });

  it('remembers a sent digest once, per project, admin and week', async () => {
    const ana = await admins.grantAccess('ana@example.com', SHOP_ID);
    const delivery = { projectId: SHOP_ID, adminUserId: ana.id, weekStart: '2026-10-05' };

    expect(await deliveries.wasSent(delivery)).toBe(false);
    await deliveries.recordSent(delivery, SENT_AT);
    await deliveries.recordSent(delivery, new Date('2026-10-12T12:00:00.000Z'));

    expect(await deliveries.wasSent(delivery)).toBe(true);
    expect(await deliveries.wasSent({ ...delivery, weekStart: '2026-10-12' })).toBe(false);
    expect(await deliveries.wasSent({ ...delivery, projectId: BLOG_ID })).toBe(false);
    const rows = await owner<{ week_start: string; sent_at: Date }[]>`
      SELECT week_start::text, sent_at FROM digest_deliveries
    `;
    expect(rows).toEqual([{ week_start: '2026-10-05', sent_at: SENT_AT }]);
  });

  it('forgets the deliveries of a deleted project', async () => {
    const ana = await admins.grantAccess('ana@example.com', SHOP_ID);
    await deliveries.recordSent(
      { projectId: SHOP_ID, adminUserId: ana.id, weekStart: '2026-10-05' },
      SENT_AT,
    );

    await owner`DELETE FROM projects WHERE id = ${SHOP_ID}`;

    const [row] = await owner<{ count: string }[]>`SELECT count(*) FROM digest_deliveries`;
    expect(row?.count).toBe('0');
  });
});
