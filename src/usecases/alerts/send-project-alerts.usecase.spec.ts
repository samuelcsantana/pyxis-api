import { Logger } from '@nestjs/common';
import type { AlertRecipient } from '../../domain/alerts/alert-recipients';
import type { AlertKind, ProjectAlert } from '../../domain/alerts/project-alert';
import type { Project } from '../../domain/entities/project.entity';
import { FixedClock } from '../../test-utils/fixed-clock';
import { InMemoryAlertDeliveryRepository } from '../../test-utils/in-memory-alert-delivery.repository';
import { RecordingMailSender } from '../../test-utils/recording-mail-sender';
import { StubAlertRecipientsQuery } from '../../test-utils/stub-alert-recipients.query';
import type { DetectProjectAlertsUseCase } from './detect-project-alerts.usecase';
import { SendProjectAlertsUseCase } from './send-project-alerts.usecase';

const NOW = new Date('2026-11-05T06:00:00.000Z');
const SHOP: Project = {
  id: '00000000-0000-4000-b000-000000000001',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'America/Sao_Paulo',
  conversionEvent: null,
  currency: 'BRL',
  cityEnabled: false,
  visitorsEnabled: false,
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
};
const BLOG: Project = { ...SHOP, id: '00000000-0000-4000-b000-000000000002', name: 'Blog' };
const ANA = '00000000-0000-4000-a000-000000000001';
const BRUNO = '00000000-0000-4000-a000-000000000002';
const ACTIVE = { status: 'active', suspendedAt: null, ingestionPausedUntil: null } as const;

function recipient(
  adminUserId: string,
  project: Project,
  kinds: readonly AlertKind[],
  overrides: Partial<AlertRecipient> = {},
): AlertRecipient {
  return {
    adminUserId,
    email: `${adminUserId === ANA ? 'ana' : 'bruno'}@example.com`,
    emailLanguage: adminUserId === ANA ? 'en' : 'pt-BR',
    project,
    account: ACTIVE,
    ingestionSuspended: false,
    kinds,
    ...overrides,
  };
}

function silence(project: Project): ProjectAlert {
  return {
    kind: 'no_events',
    projectId: project.id,
    projectName: project.name,
    timeZone: project.timezone,
    lastEventAt: new Date('2026-11-04T01:00:00.000Z'),
    visitsBefore: 90,
  };
}

function spike(project: Project): ProjectAlert {
  return {
    kind: 'failed_writes',
    projectId: project.id,
    projectName: project.name,
    timeZone: project.timezone,
    day: '2026-11-04',
    failed: 12,
    total: 40,
    usualRate: 0.02,
  };
}

function setup(
  recipients: readonly AlertRecipient[],
  alertsOf: (project: Project) => Promise<readonly ProjectAlert[]>,
) {
  const asked: (readonly [string, readonly AlertKind[]])[] = [];
  const detect = {
    execute: (project: Project, kinds: ReadonlySet<AlertKind>) => {
      asked.push([project.id, [...kinds].sort()]);
      return alertsOf(project);
    },
  } as unknown as DetectProjectAlertsUseCase;
  const deliveries = new InMemoryAlertDeliveryRepository();
  const mail = new RecordingMailSender();
  return {
    asked,
    deliveries,
    mail,
    send: new SendProjectAlertsUseCase(
      new StubAlertRecipientsQuery(recipients),
      deliveries,
      detect,
      mail,
      new FixedClock(NOW),
    ),
  };
}

describe('SendProjectAlertsUseCase', () => {
  let logs: unknown[];
  let errors: unknown[];

  beforeEach(() => {
    logs = [];
    errors = [];
    jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      logs.push(message);
    });
    jest.spyOn(Logger.prototype, 'error').mockImplementation((message: unknown) => {
      errors.push(message);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('detects once per project the kinds its people want, and sends each only what they chose', async () => {
    const { send, mail, asked } = setup(
      [
        recipient(ANA, SHOP, ['no_events', 'failed_writes']),
        recipient(BRUNO, SHOP, ['failed_writes', 'conversion_drop']),
      ],
      (project) => Promise.resolve([silence(project), spike(project)]),
    );

    const report = await send.execute();

    expect(asked).toEqual([[SHOP.id, ['conversion_drop', 'failed_writes', 'no_events']]]);
    expect(
      mail.projectAlerts.map(({ email, alert, language }) => [email, alert.kind, language]),
    ).toEqual([
      ['ana@example.com', 'no_events', 'en'],
      ['ana@example.com', 'failed_writes', 'en'],
      ['bruno@example.com', 'failed_writes', 'pt-BR'],
    ]);
    expect(report).toEqual({
      projects: 1,
      raised: 2,
      sent: 3,
      alreadySent: 0,
      failed: 0,
      failedProjects: 0,
    });
    expect(logs).toContainEqual({ message: 'alerts.completed', ...report });
    expect(JSON.stringify(logs)).not.toContain('@example.com');
  });

  it('sends each kind at most once a day for a project and a person, even when run again', async () => {
    const { send, mail, deliveries } = setup([recipient(ANA, SHOP, ['no_events'])], (project) =>
      Promise.resolve([silence(project)]),
    );

    await send.execute();
    const again = await send.execute();

    expect(mail.projectAlerts).toHaveLength(1);
    expect(again).toMatchObject({ raised: 1, sent: 0, alreadySent: 1 });
    expect(deliveries.recorded).toEqual([`${SHOP.id}:${ANA}:no_events:2026-11-05`]);
  });

  it('keeps sending to the others when one e-mail fails, and records only what left', async () => {
    const { send, mail, deliveries } = setup(
      [recipient(ANA, SHOP, ['no_events']), recipient(BRUNO, SHOP, ['no_events'])],
      (project) => Promise.resolve([silence(project)]),
    );
    mail.failFor('ana@example.com', new Error('mailbox full'));

    const report = await send.execute();

    expect(mail.projectAlerts.map(({ email }) => email)).toEqual(['bruno@example.com']);
    expect(report).toMatchObject({ sent: 1, failed: 1 });
    expect(deliveries.recorded).toEqual([`${SHOP.id}:${BRUNO}:no_events:2026-11-05`]);
    expect(errors).toEqual([
      expect.objectContaining({ message: 'alerts.delivery_failed', error: 'mailbox full' }),
    ]);
  });

  it('logs a failure that is not an Error by its text', async () => {
    const { send, mail } = setup([recipient(ANA, SHOP, ['no_events'])], (project) =>
      Promise.resolve([silence(project)]),
    );
    mail.failFor('ana@example.com', 'refused' as unknown as Error);

    await send.execute();

    expect(errors).toEqual([expect.objectContaining({ error: 'refused' })]);
  });

  it('keeps alerting the other projects when one project cannot be measured', async () => {
    const { send, mail } = setup(
      [recipient(ANA, BLOG, ['no_events']), recipient(ANA, SHOP, ['no_events'])],
      (project) =>
        project.id === BLOG.id
          ? Promise.reject(new Error('statement timeout'))
          : Promise.resolve([silence(project)]),
    );

    const report = await send.execute();

    expect(mail.projectAlerts.map(({ alert }) => alert.projectId)).toEqual([SHOP.id]);
    expect(report).toMatchObject({ projects: 2, raised: 1, sent: 1, failedProjects: 1 });
    expect(errors).toEqual([
      { message: 'alerts.detection_failed', projectId: BLOG.id, error: 'statement timeout' },
    ]);
  });

  it('leaves out the projects whose account may not be alerted', async () => {
    const { send, asked } = setup(
      [
        recipient(ANA, SHOP, ['no_events'], { account: { ...ACTIVE, status: 'ended' } }),
        recipient(BRUNO, BLOG, ['no_events'], { ingestionSuspended: true }),
      ],
      () => Promise.resolve([]),
    );

    await expect(send.execute()).resolves.toMatchObject({ projects: 0, sent: 0 });
    expect(asked).toEqual([]);
  });

  it('sends nothing when nothing was raised', async () => {
    const { send, mail } = setup([recipient(ANA, SHOP, ['no_events'])], () => Promise.resolve([]));

    await expect(send.execute()).resolves.toEqual({
      projects: 1,
      raised: 0,
      sent: 0,
      alreadySent: 0,
      failed: 0,
      failedProjects: 0,
    });
    expect(mail.projectAlerts).toEqual([]);
  });
});
