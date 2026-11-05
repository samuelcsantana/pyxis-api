import type postgres from 'postgres';
import {
  createDrizzleDatabase,
  createPostgresClient,
} from '../../src/infra/database/postgres-client';
import { DrizzleAlertRecipientsQuery } from '../../src/infra/queries/drizzle-alert-recipients.query';
import { DrizzleOverviewQuery } from '../../src/infra/queries/drizzle-overview.query';
import { DrizzleProjectActivityQuery } from '../../src/infra/queries/drizzle-project-activity.query';
import { DrizzleAdminUserRepository } from '../../src/infra/repositories/drizzle-admin-user.repository';
import { DrizzleAlertDeliveryRepository } from '../../src/infra/repositories/drizzle-alert-delivery.repository';
import { DrizzleEmailPreferencesRepository } from '../../src/infra/repositories/drizzle-email-preferences.repository';
import { DrizzleGoalRepository } from '../../src/infra/repositories/drizzle-goal.repository';
import { FixedClock } from '../../src/test-utils/fixed-clock';
import { RecordingMailSender } from '../../src/test-utils/recording-mail-sender';
import { DetectProjectAlertsUseCase } from '../../src/usecases/alerts/detect-project-alerts.usecase';
import { SendProjectAlertsUseCase } from '../../src/usecases/alerts/send-project-alerts.usecase';
import { connectAsOwner, emptyIngestionTables, migrateTestDatabase } from './migrated-database';
import { testAppUrl } from './test-database';

const NOW = new Date('2026-11-05T06:00:00.000Z');
const SILENT_ID = 'a1000000-0000-4000-8000-000000000001';
const FAILING_ID = 'a1000000-0000-4000-8000-000000000002';
const DROPPING_ID = 'a1000000-0000-4000-8000-000000000003';
const SMALL_ID = 'a1000000-0000-4000-8000-000000000004';

describe('project alerts against a real Postgres', () => {
  let owner: postgres.Sql;
  let app: postgres.Sql;
  let admins: DrizzleAdminUserRepository;
  let preferences: DrizzleEmailPreferencesRepository;
  let goals: DrizzleGoalRepository;
  let mail: RecordingMailSender;
  let sendAlerts: SendProjectAlertsUseCase;

  async function pageViews(projectId: string, at: string, sessions: number): Promise<void> {
    await owner`
      INSERT INTO events (id, project_id, occurred_at, received_at, name, session_id, path,
                          device_type, browser, os, properties)
      SELECT gen_random_uuid(), ${projectId}, ${at}::timestamptz + n * interval '1 minute',
             ${NOW}, 'page_view', gen_random_uuid(), '/', 'desktop', 'chrome', 'macos', '{}'
      FROM generate_series(1, ${sessions}) AS n`;
  }

  async function writes(projectId: string, at: string, count: number, status: number) {
    await owner`
      INSERT INTO events (id, project_id, occurred_at, received_at, name, session_id, path,
                          device_type, browser, os, properties)
      SELECT gen_random_uuid(), ${projectId}, ${at}::timestamptz + n * interval '1 second',
             ${NOW}, 'api_request', gen_random_uuid(), '/checkout', 'desktop', 'chrome', 'macos',
             jsonb_build_object('method', 'POST', 'route', '/orders', 'status', ${status}::int)
      FROM generate_series(1, ${count}) AS n`;
  }

  async function purchases(projectId: string, at: string, count: number): Promise<void> {
    await owner`
      INSERT INTO events (id, project_id, occurred_at, received_at, name, session_id, path,
                          device_type, browser, os, properties)
      SELECT gen_random_uuid(), ${projectId}, ${at}::timestamptz + n * interval '1 minute',
             ${NOW}, 'purchase', gen_random_uuid(), '/checkout', 'desktop', 'chrome', 'macos', '{}'
      FROM generate_series(1, ${count}) AS n`;
  }

  beforeAll(async () => {
    await migrateTestDatabase();
    owner = connectAsOwner();
    app = createPostgresClient(testAppUrl());
    const db = createDrizzleDatabase(app);
    admins = new DrizzleAdminUserRepository(db);
    preferences = new DrizzleEmailPreferencesRepository(db);
    goals = new DrizzleGoalRepository(db);
    mail = new RecordingMailSender();
    sendAlerts = new SendProjectAlertsUseCase(
      new DrizzleAlertRecipientsQuery(db),
      new DrizzleAlertDeliveryRepository(db),
      new DetectProjectAlertsUseCase(
        new DrizzleOverviewQuery(db),
        new DrizzleProjectActivityQuery(db),
        goals,
      ),
      mail,
      new FixedClock(NOW),
    );
    await emptyIngestionTables(owner);
    await owner`
      INSERT INTO projects (id, name, timezone)
      VALUES (${SILENT_ID}, 'Silent', 'UTC'), (${FAILING_ID}, 'Failing', 'UTC'),
             (${DROPPING_ID}, 'Dropping', 'UTC'), (${SMALL_ID}, 'Small', 'UTC')`;
    await pageViews(SILENT_ID, '2026-11-02T10:00:00Z', 30);
    await pageViews(FAILING_ID, '2026-11-05T05:00:00Z', 1);
    await writes(FAILING_ID, '2026-10-30T12:00:00Z', 294, 201);
    await writes(FAILING_ID, '2026-10-31T12:00:00Z', 6, 500);
    await writes(FAILING_ID, '2026-11-04T12:00:00Z', 28, 201);
    await writes(FAILING_ID, '2026-11-04T13:00:00Z', 12, 500);
    await pageViews(DROPPING_ID, '2026-11-05T05:00:00Z', 1);
    await purchases(DROPPING_ID, '2026-10-28T12:00:00Z', 12);
    await purchases(DROPPING_ID, '2026-11-04T12:00:00Z', 4);
    await goals.create(
      DROPPING_ID,
      { name: 'Purchase', target: { type: 'event', name: 'purchase' } },
      10,
    );
    await pageViews(SMALL_ID, '2026-11-02T10:00:00Z', 3);
    for (const projectId of [SILENT_ID, FAILING_ID, DROPPING_ID, SMALL_ID]) {
      await admins.grantAccess('ana@example.com', projectId);
    }
    const bruno = await admins.grantAccess('bruno@example.com', DROPPING_ID);
    await preferences.save(bruno.id, DROPPING_ID, { conversionDropAlert: false });
  });

  afterAll(async () => {
    await app.end();
    await owner.end();
  });

  it('raises each alert from the stored events and mails it to who wants it', async () => {
    const report = await sendAlerts.execute();

    expect(
      mail.projectAlerts.map(({ email, alert }) => [email, alert.projectName, alert.kind]),
    ).toEqual([
      ['ana@example.com', 'Dropping', 'conversion_drop'],
      ['ana@example.com', 'Failing', 'failed_writes'],
      ['ana@example.com', 'Silent', 'no_events'],
    ]);
    expect(mail.projectAlerts.map(({ alert }) => alert)).toEqual([
      expect.objectContaining({ day: '2026-11-04', conversions: 4, comparedConversions: 12 }),
      expect.objectContaining({ day: '2026-11-04', failed: 12, total: 40, usualRate: 0.02 }),
      expect.objectContaining({ visitsBefore: 30 }),
    ]);
    expect(report).toEqual({
      projects: 4,
      raised: 3,
      sent: 3,
      alreadySent: 0,
      failed: 0,
      failedProjects: 0,
    });
  });

  it('sends none of them again the same day', async () => {
    const report = await sendAlerts.execute();

    expect(report).toMatchObject({ raised: 3, sent: 0, alreadySent: 3 });
    expect(mail.projectAlerts).toHaveLength(3);
  });
});
