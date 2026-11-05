import { Logger } from '@nestjs/common';
import type { AlertKind, ProjectAlert } from '../../domain/alerts/project-alert';
import type { Project } from '../../domain/entities/project.entity';
import type { SlackDestination } from '../../domain/slack/slack-destinations';
import { slackWebhookContext } from '../../domain/slack/slack-webhook';
import { FixedClock } from '../../test-utils/fixed-clock';
import {
  FakeSecretBox,
  InMemorySlackAlertDeliveryRepository,
  InMemorySlackWebhookRepository,
  RecordingSlackSender,
  StubSlackDestinationsQuery,
} from '../../test-utils/in-memory-slack';
import type { DetectProjectAlertsUseCase } from '../alerts/detect-project-alerts.usecase';
import { SendSlackAlertsUseCase } from './send-slack-alerts.usecase';

const NOW = new Date('2026-11-05T06:00:00.000Z');
const DAY = '2026-11-05';
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
const SHOP_HOOK = 'https://hooks.slack.com/services/T0001/B0001/shopshopshopWXYZ';
const BLOG_HOOK = 'https://hooks.slack.com/services/T0001/B0002/blogblogblogA1b2';
const ACTIVE = { status: 'active', suspendedAt: null, ingestionPausedUntil: null } as const;
const box = new FakeSecretBox();

function destination(
  project: Project,
  url: string,
  overrides: Partial<SlackDestination> = {},
): SlackDestination {
  return {
    project,
    account: ACTIVE,
    ingestionSuspended: false,
    ownerLanguage: 'pt-BR',
    sealedWebhook: box.seal(url, slackWebhookContext(project.id)),
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

async function setup(
  destinations: readonly SlackDestination[],
  alertsOf: (project: Project) => Promise<readonly ProjectAlert[]>,
) {
  const asked: (readonly [string, readonly AlertKind[]])[] = [];
  const detect = {
    execute: (project: Project, kinds: ReadonlySet<AlertKind>) => {
      asked.push([project.id, [...kinds].sort()]);
      return alertsOf(project);
    },
  } as unknown as DetectProjectAlertsUseCase;
  const webhooks = new InMemorySlackWebhookRepository();
  for (const each of destinations) {
    await webhooks.save(each.project.id, { sealed: each.sealedWebhook, hint: 'hint' }, NOW);
  }
  const deliveries = new InMemorySlackAlertDeliveryRepository();
  const slack = new RecordingSlackSender();
  return {
    asked,
    webhooks,
    deliveries,
    slack,
    send: new SendSlackAlertsUseCase(
      new StubSlackDestinationsQuery(destinations),
      deliveries,
      webhooks,
      detect,
      box,
      slack,
      new FixedClock(NOW),
    ),
  };
}

describe('SendSlackAlertsUseCase', () => {
  let logs: unknown[];
  let errors: unknown[];

  beforeEach(() => {
    logs = [];
    errors = [];
    jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      logs.push(message);
    });
    jest.spyOn(Logger.prototype, 'warn').mockImplementation((message: unknown) => {
      logs.push(message);
    });
    jest.spyOn(Logger.prototype, 'error').mockImplementation((message: unknown) => {
      errors.push(message);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('posts every raised alert once to the project webhook, in the owner language', async () => {
    const { send, slack, deliveries, asked } = await setup(
      [destination(SHOP, SHOP_HOOK), destination(BLOG, BLOG_HOOK, { ownerLanguage: 'de' })],
      (project) =>
        Promise.resolve(project.id === SHOP.id ? [silence(SHOP), spike(SHOP)] : [spike(BLOG)]),
    );

    await expect(send.execute()).resolves.toEqual({
      projects: 2,
      raised: 3,
      sent: 3,
      alreadySent: 0,
      failed: 0,
      broken: 0,
      failedProjects: 0,
    });
    expect(asked).toEqual([
      [SHOP.id, ['conversion_drop', 'failed_writes', 'no_events']],
      [BLOG.id, ['conversion_drop', 'failed_writes', 'no_events']],
    ]);
    expect(slack.posted).toEqual([
      { webhookUrl: SHOP_HOOK, alert: silence(SHOP), projectName: null, language: 'pt-BR' },
      { webhookUrl: SHOP_HOOK, alert: spike(SHOP), projectName: null, language: 'pt-BR' },
      { webhookUrl: BLOG_HOOK, alert: spike(BLOG), projectName: null, language: 'de' },
    ]);
    expect(deliveries.recorded).toEqual([
      `${SHOP.id}:no_events:${DAY}`,
      `${SHOP.id}:failed_writes:${DAY}`,
      `${BLOG.id}:failed_writes:${DAY}`,
    ]);
    expect(logs).toContainEqual(
      expect.objectContaining({ message: 'slack_alerts.completed', sent: 3 }),
    );
    expect(JSON.stringify(logs)).not.toContain('hooks.slack.com');
  });

  it('posts nothing for an account off Pro, one that may not be alerted, or a halted project', async () => {
    const { send, slack } = await setup(
      [
        destination(SHOP, SHOP_HOOK, { account: { ...ACTIVE, status: 'free' } }),
        destination(BLOG, BLOG_HOOK, { account: { ...ACTIVE, suspendedAt: NOW } }),
        destination({ ...SHOP, id: '00000000-0000-4000-b000-000000000003' }, SHOP_HOOK, {
          ingestionSuspended: true,
        }),
      ],
      () => Promise.resolve([silence(SHOP)]),
    );

    await expect(send.execute()).resolves.toMatchObject({ projects: 0, sent: 0 });
    expect(slack.posted).toEqual([]);
  });

  it('posts for an operator project, which has no account and counts as Pro', async () => {
    const { send, slack } = await setup([destination(SHOP, SHOP_HOOK, { account: null })], () =>
      Promise.resolve([silence(SHOP)]),
    );

    await expect(send.execute()).resolves.toMatchObject({ projects: 1, sent: 1 });
    expect(slack.posted).toHaveLength(1);
  });

  it('does not post twice in a UTC day what was already posted', async () => {
    const { send, slack, deliveries } = await setup([destination(SHOP, SHOP_HOOK)], () =>
      Promise.resolve([silence(SHOP), spike(SHOP)]),
    );
    await deliveries.recordSent({ projectId: SHOP.id, kind: 'no_events', day: DAY });

    await expect(send.execute()).resolves.toMatchObject({ sent: 1, alreadySent: 1 });
    expect(slack.posted.map(({ alert }) => alert?.kind)).toEqual(['failed_writes']);
  });

  it('marks a webhook Slack says is gone broken, and stops posting to it, never the others', async () => {
    const { send, slack, webhooks } = await setup(
      [destination(SHOP, SHOP_HOOK), destination(BLOG, BLOG_HOOK)],
      (project) => Promise.resolve([silence(project), spike(project)]),
    );
    slack.answer(SHOP_HOOK, { outcome: 'gone', reason: 'no_service' });

    await expect(send.execute()).resolves.toMatchObject({ sent: 2, broken: 1, failed: 0 });
    expect(slack.posted.map(({ webhookUrl }) => webhookUrl)).toEqual([
      SHOP_HOOK,
      BLOG_HOOK,
      BLOG_HOOK,
    ]);
    await expect(webhooks.statusOf(SHOP.id)).resolves.toMatchObject({
      brokenAt: NOW,
      brokenReason: 'no_service',
    });
    await expect(webhooks.statusOf(BLOG.id)).resolves.toMatchObject({ brokenAt: null });
  });

  it('counts a post Slack refused as failed, unrecorded, and goes on with the next alert', async () => {
    const { send, slack, deliveries } = await setup([destination(SHOP, SHOP_HOOK)], () =>
      Promise.resolve([silence(SHOP), spike(SHOP)]),
    );
    slack.answer(SHOP_HOOK, { outcome: 'failed', status: 500 });

    await expect(send.execute()).resolves.toMatchObject({ sent: 0, failed: 2 });
    expect(slack.posted).toHaveLength(2);
    expect(deliveries.recorded).toEqual([]);
    expect(errors).toContainEqual(
      expect.objectContaining({ message: 'slack_alerts.delivery_failed', status: 500 }),
    );
  });

  it('counts a post that threw as failed, logging what it swallowed', async () => {
    const { send, slack } = await setup([destination(SHOP, SHOP_HOOK)], () =>
      Promise.resolve([silence(SHOP)]),
    );
    jest.spyOn(slack, 'postAlert').mockRejectedValue(new Error('socket hang up'));

    await expect(send.execute()).resolves.toMatchObject({ failed: 1 });
    expect(errors).toContainEqual(
      expect.objectContaining({ message: 'slack_alerts.post_threw', error: 'socket hang up' }),
    );
  });

  it('logs a project whose detection failed and goes on with the others', async () => {
    const { send, slack } = await setup(
      [destination(SHOP, SHOP_HOOK), destination(BLOG, BLOG_HOOK)],
      (project) =>
        project.id === SHOP.id
          ? Promise.reject(new Error('database went away'))
          : Promise.resolve([silence(BLOG)]),
    );

    await expect(send.execute()).resolves.toMatchObject({
      projects: 2,
      sent: 1,
      failedProjects: 1,
    });
    expect(slack.posted.map(({ webhookUrl }) => webhookUrl)).toEqual([BLOG_HOOK]);
    expect(errors).toContainEqual(
      expect.objectContaining({
        message: 'slack_alerts.detection_failed',
        projectId: SHOP.id,
        error: 'database went away',
      }),
    );
  });

  it('counts the alerts of a webhook it cannot open as failed, posting nothing', async () => {
    const { send, slack } = await setup(
      [destination(SHOP, SHOP_HOOK, { sealedWebhook: 'sealed:another-context:x' })],
      () => Promise.resolve([silence(SHOP), spike(SHOP)]),
    );

    await expect(send.execute()).resolves.toMatchObject({ failed: 2, sent: 0 });
    expect(slack.posted).toEqual([]);
    expect(errors).toContainEqual(
      expect.objectContaining({ message: 'slack_alerts.webhook_unreadable', projectId: SHOP.id }),
    );
  });

  it('opens nothing for a project with no alert', async () => {
    const { send, slack } = await setup(
      [destination(SHOP, SHOP_HOOK, { sealedWebhook: 'unreadable' })],
      () => Promise.resolve([]),
    );

    await expect(send.execute()).resolves.toMatchObject({ projects: 1, raised: 0, failed: 0 });
    expect(slack.posted).toEqual([]);
    expect(errors).toEqual([]);
  });

  it('reports a thrown non-error as its text', async () => {
    const { send } = await setup(
      [destination(SHOP, SHOP_HOOK)],
      jest.fn().mockRejectedValue('plain text'),
    );

    await send.execute();

    expect(errors).toContainEqual(
      expect.objectContaining({ message: 'slack_alerts.detection_failed', error: 'plain text' }),
    );
  });
});
