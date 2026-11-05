import type postgres from 'postgres';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleSlackDestinationsQuery } from '../../src/infra/queries/drizzle-slack-destinations.query';
import {
  DrizzleSlackAlertDeliveryRepository,
  DrizzleSlackWebhookRepository,
} from '../../src/infra/repositories/drizzle-slack-webhook.repository';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const SHOP_ID = 'a3f1c2d4-5b6e-4f70-8192-a3b4c5d6e7f8';
const BLOG_ID = 'b4e2d3c5-6c7f-4081-9203-b4c5d6e7f809';
const ACCOUNT_ID = 'c5f3e4d6-7d80-4192-a314-c5d6e7f8091a';
const OWNER_ID = 'd6a4f5e7-8e91-42a3-b425-d6e7f8091a2b';
const CONNECTED_AT = new Date('2026-11-05T12:00:00.000Z');
const LATER = new Date('2026-11-05T13:00:00.000Z');
const BROKEN_AT = new Date('2026-11-06T06:00:01.000Z');
const PAUSED_UNTIL = new Date('2026-12-01T00:00:00.000Z');
const SUSPENDED_AT = new Date('2026-11-01T00:00:00.000Z');
const SHOP_WEBHOOK = { sealed: 'v1.iv.tag.shop', hint: 'WXYZ' };
const BLOG_WEBHOOK = { sealed: 'v1.iv.tag.blog', hint: 'A1b2' };

describe('Slack alert storage against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let webhooks: DrizzleSlackWebhookRepository;
  let deliveries: DrizzleSlackAlertDeliveryRepository;
  let destinations: DrizzleSlackDestinationsQuery;

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    const db = createDrizzleDatabase(app);
    webhooks = new DrizzleSlackWebhookRepository(db);
    deliveries = new DrizzleSlackAlertDeliveryRepository(db);
    destinations = new DrizzleSlackDestinationsQuery(db);
  });

  beforeEach(async () => {
    await emptyIngestionTables(owner);
    await owner`
      INSERT INTO admin_users (id, email, email_language)
      VALUES (${OWNER_ID}, 'owner@example.com', 'de')`;
    await owner`
      INSERT INTO accounts (id, owner_admin_id, status, ingestion_paused_until, suspended_at)
      VALUES (${ACCOUNT_ID}, ${OWNER_ID}, 'active', ${PAUSED_UNTIL}, ${SUSPENDED_AT})`;
    await owner`
      INSERT INTO projects (id, name, timezone, account_id, ingestion_suspended_at)
      VALUES (${SHOP_ID}, 'Shop', 'America/Sao_Paulo', ${ACCOUNT_ID}, ${SUSPENDED_AT}),
             (${BLOG_ID}, 'Blog', 'UTC', NULL, NULL)`;
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it('keeps one sealed webhook per project, answering only its status', async () => {
    await expect(webhooks.statusOf(SHOP_ID)).resolves.toBeNull();
    await expect(webhooks.sealedOf(SHOP_ID)).resolves.toBeNull();

    await expect(webhooks.save(SHOP_ID, SHOP_WEBHOOK, CONNECTED_AT)).resolves.toEqual({
      hint: 'WXYZ',
      connectedAt: CONNECTED_AT,
      brokenAt: null,
      brokenReason: null,
    });
    await expect(webhooks.sealedOf(SHOP_ID)).resolves.toBe('v1.iv.tag.shop');
    await expect(webhooks.statusOf(SHOP_ID)).resolves.toEqual({
      hint: 'WXYZ',
      connectedAt: CONNECTED_AT,
      brokenAt: null,
      brokenReason: null,
    });
  });

  it('marks a webhook broken, and clears the mark when the owner replaces it', async () => {
    await webhooks.save(SHOP_ID, SHOP_WEBHOOK, CONNECTED_AT);

    await webhooks.markBroken(SHOP_ID, 'no_service', BROKEN_AT);
    await expect(webhooks.statusOf(SHOP_ID)).resolves.toMatchObject({
      brokenAt: BROKEN_AT,
      brokenReason: 'no_service',
    });

    await expect(webhooks.save(SHOP_ID, BLOG_WEBHOOK, LATER)).resolves.toEqual({
      hint: 'A1b2',
      connectedAt: LATER,
      brokenAt: null,
      brokenReason: null,
    });
    await expect(webhooks.sealedOf(SHOP_ID)).resolves.toBe('v1.iv.tag.blog');
    const rows = await owner<{ count: number }[]>`
      SELECT count(*)::int AS count FROM project_slack_webhooks`;
    expect(rows).toEqual([{ count: 1 }]);
  });

  it('removes a webhook once, and forgets it with its project', async () => {
    await webhooks.save(SHOP_ID, SHOP_WEBHOOK, CONNECTED_AT);
    await webhooks.save(BLOG_ID, BLOG_WEBHOOK, CONNECTED_AT);

    await expect(webhooks.remove(SHOP_ID)).resolves.toBe(true);
    await expect(webhooks.remove(SHOP_ID)).resolves.toBe(false);
    await owner`DELETE FROM projects WHERE id = ${BLOG_ID}`;

    const rows = await owner`SELECT project_id FROM project_slack_webhooks`;
    expect(rows).toEqual([]);
  });

  it('lists the working webhooks with their project, account state and owner language', async () => {
    await webhooks.save(SHOP_ID, SHOP_WEBHOOK, CONNECTED_AT);
    await webhooks.save(BLOG_ID, BLOG_WEBHOOK, CONNECTED_AT);

    const listed = await destinations.destinations();

    expect(listed).toEqual([
      {
        project: expect.objectContaining({ id: BLOG_ID, name: 'Blog' }) as object,
        account: null,
        ingestionSuspended: false,
        ownerLanguage: 'en',
        sealedWebhook: 'v1.iv.tag.blog',
      },
      {
        project: expect.objectContaining({ id: SHOP_ID, timezone: 'America/Sao_Paulo' }) as object,
        account: {
          status: 'active',
          suspendedAt: SUSPENDED_AT,
          ingestionPausedUntil: PAUSED_UNTIL,
        },
        ingestionSuspended: true,
        ownerLanguage: 'de',
        sealedWebhook: 'v1.iv.tag.shop',
      },
    ]);
  });

  it('leaves a broken webhook out of the daily run', async () => {
    await webhooks.save(SHOP_ID, SHOP_WEBHOOK, CONNECTED_AT);
    await webhooks.save(BLOG_ID, BLOG_WEBHOOK, CONNECTED_AT);
    await webhooks.markBroken(BLOG_ID, 'channel_not_found', BROKEN_AT);

    const listed = await destinations.destinations();

    expect(listed.map(({ project }) => project.id)).toEqual([SHOP_ID]);
  });

  it('remembers a posted alert once, per project, kind and day', async () => {
    const delivery = { projectId: SHOP_ID, kind: 'no_events', day: '2026-11-05' } as const;

    expect(await deliveries.wasSent(delivery)).toBe(false);
    await deliveries.recordSent(delivery, CONNECTED_AT);
    await deliveries.recordSent(delivery, LATER);

    expect(await deliveries.wasSent(delivery)).toBe(true);
    expect(await deliveries.wasSent({ ...delivery, day: '2026-11-06' })).toBe(false);
    expect(await deliveries.wasSent({ ...delivery, kind: 'failed_writes' })).toBe(false);
    expect(await deliveries.wasSent({ ...delivery, projectId: BLOG_ID })).toBe(false);
    const rows = await owner<{ kind: string; day: string; sent_at: Date }[]>`
      SELECT kind, day::text, sent_at FROM slack_alert_deliveries`;
    expect(rows).toEqual([{ kind: 'no_events', day: '2026-11-05', sent_at: CONNECTED_AT }]);
  });

  it('refuses a kind of alert it does not know', async () => {
    await expect(owner`
      INSERT INTO slack_alert_deliveries (project_id, kind, day, sent_at)
      VALUES (${SHOP_ID}, 'traffic_up', '2026-11-05', ${CONNECTED_AT})`).rejects.toThrow(
      /slack_alert_deliveries_kind_check/,
    );
  });

  it('forgets the posted alerts of a deleted project', async () => {
    await deliveries.recordSent(
      { projectId: SHOP_ID, kind: 'failed_writes', day: '2026-11-05' },
      CONNECTED_AT,
    );

    await owner`DELETE FROM projects WHERE id = ${SHOP_ID}`;

    const rows = await owner`SELECT project_id FROM slack_alert_deliveries`;
    expect(rows).toEqual([]);
  });
});
