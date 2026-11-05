import type { AccountStatus } from '../../domain/accounts/account-status';
import {
  AccountSuspendedError,
  PlanRequiredError,
  SubscriptionRequiredError,
} from '../../domain/errors/account.errors';
import { ProjectNotFoundError } from '../../domain/errors/project.errors';
import {
  InvalidSlackWebhookError,
  SlackWebhookNotFoundError,
} from '../../domain/errors/slack.errors';
import { MAX_SLACK_BROKEN_REASON_LENGTH } from '../../domain/slack/slack-webhook';
import { FixedClock } from '../../test-utils/fixed-clock';
import { InMemoryAccountRepository } from '../../test-utils/in-memory-account.repository';
import { InMemoryAdminUserRepository } from '../../test-utils/in-memory-admin-user.repository';
import { InMemoryProjectRepository } from '../../test-utils/in-memory-project.repository';
import {
  FAKE_SEAL_PREFIX,
  FakeSecretBox,
  InMemorySlackWebhookRepository,
  RecordingSlackSender,
} from '../../test-utils/in-memory-slack';
import { SequenceRandomSource } from '../../test-utils/sequence-random-source';
import { CreateProjectUseCase } from '../projects/create-project.usecase';
import { GetSlackWebhookUseCase } from './get-slack-webhook.usecase';
import { RemoveSlackWebhookUseCase } from './remove-slack-webhook.usecase';
import { SetSlackWebhookUseCase } from './set-slack-webhook.usecase';
import { TestSlackWebhookUseCase } from './test-slack-webhook.usecase';

const OWNER_ID = 'ad000000-0000-4000-a000-000000000001';
const MEMBER_ID = 'ad000000-0000-4000-a000-000000000002';
const NOW = new Date('2026-11-05T12:00:00.000Z');
const LATER = new Date('2026-11-05T13:00:00.000Z');
const ALPHABET_SIZE = 62;
const WEBHOOK = 'https://hooks.slack.com/services/T0001/B0002/abcdefghijklmnopqrstWXYZ';
const OTHER_WEBHOOK = 'https://hooks.slack.com/services/T0001/B0003/zyxwvutsrqponmlkjihgA1b2';

async function setup(status: AccountStatus = 'active') {
  const store = new InMemoryProjectRepository();
  const accounts = new InMemoryAccountRepository(new InMemoryAdminUserRepository());
  const account = await accounts.create({ ownerAdminId: OWNER_ID, status });
  store.addAccount(account.id, OWNER_ID);
  const { projectId } = await new CreateProjectUseCase(
    store,
    new SequenceRandomSource(Array.from({ length: ALPHABET_SIZE }, (_, index) => index)),
    accounts,
  ).execute({ name: 'Shop', allowedOrigins: ['https://shop.example.com'], accountId: account.id });
  const webhooks = new InMemorySlackWebhookRepository();
  const box = new FakeSecretBox();
  const slack = new RecordingSlackSender();
  const clock = new FixedClock(NOW);
  return {
    accounts,
    account,
    projectId,
    webhooks,
    slack,
    clock,
    setWebhook: new SetSlackWebhookUseCase(store, accounts, webhooks, box, clock),
    getWebhook: new GetSlackWebhookUseCase(store, accounts, webhooks),
    removeWebhook: new RemoveSlackWebhookUseCase(store, accounts, webhooks),
    testWebhook: new TestSlackWebhookUseCase(store, accounts, webhooks, box, slack, clock),
  };
}

describe('SetSlackWebhookUseCase', () => {
  it('keeps the address sealed for the project, and answers only its last four characters', async () => {
    const { setWebhook, webhooks, projectId } = await setup();

    const status = await setWebhook.execute({
      adminUserId: OWNER_ID,
      projectId,
      url: `  ${WEBHOOK} `,
    });

    expect(status).toEqual({ hint: 'WXYZ', connectedAt: NOW, brokenAt: null, brokenReason: null });
    expect(await webhooks.sealedOf(projectId)).toBe(
      `${FAKE_SEAL_PREFIX}slack-webhook:${projectId}:${WEBHOOK}`,
    );
  });

  it('replaces the address and clears the broken mark of the old one', async () => {
    const { setWebhook, webhooks, projectId, clock } = await setup();
    await setWebhook.execute({ adminUserId: OWNER_ID, projectId, url: WEBHOOK });
    await webhooks.markBroken(projectId, 'no_service', NOW);
    clock.advanceBy(LATER.getTime() - NOW.getTime());

    const status = await setWebhook.execute({
      adminUserId: OWNER_ID,
      projectId,
      url: OTHER_WEBHOOK,
    });

    expect(status).toEqual({
      hint: 'A1b2',
      connectedAt: LATER,
      brokenAt: null,
      brokenReason: null,
    });
  });

  it.each([
    'https://example.com/services/T0001/B0002/abcdefghijkl',
    'http://hooks.slack.com/services/T0001/B0002/abcdefghijkl',
    'https://hooks.slack.com.evil.example/services/T0001/B0002/abcdefghijkl',
    'https://hooks.slack.com/services/T0001/B0002/abcdefghijkl?redirect=https://example.com',
    'https://hooks.slack.com/workflows/T0001/B0002/abcdefghijkl',
  ])('refuses %s, which is not a Slack Incoming Webhook', async (url) => {
    const { setWebhook, projectId } = await setup();

    await expect(
      setWebhook.execute({ adminUserId: OWNER_ID, projectId, url }),
    ).rejects.toBeInstanceOf(InvalidSlackWebhookError);
  });

  it('is Pro only', async () => {
    const { setWebhook, projectId } = await setup('free');

    await expect(
      setWebhook.execute({ adminUserId: OWNER_ID, projectId, url: WEBHOOK }),
    ).rejects.toBeInstanceOf(PlanRequiredError);
  });

  it('needs a running subscription and an account that is not suspended', async () => {
    const ended = await setup('ended');
    await expect(
      ended.setWebhook.execute({ adminUserId: OWNER_ID, projectId: ended.projectId, url: WEBHOOK }),
    ).rejects.toBeInstanceOf(SubscriptionRequiredError);

    const suspended = await setup();
    await suspended.accounts.suspend(suspended.account.id, 'abuse', NOW);
    await expect(
      suspended.setWebhook.execute({
        adminUserId: OWNER_ID,
        projectId: suspended.projectId,
        url: WEBHOOK,
      }),
    ).rejects.toBeInstanceOf(AccountSuspendedError);
  });

  it('answers project_not_found to anyone but the owner', async () => {
    const { setWebhook, projectId } = await setup();

    await expect(
      setWebhook.execute({ adminUserId: MEMBER_ID, projectId, url: WEBHOOK }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });
});

describe('GetSlackWebhookUseCase', () => {
  it('answers null before a webhook is set, and its masked status after', async () => {
    const { setWebhook, getWebhook, projectId } = await setup();

    await expect(getWebhook.execute({ adminUserId: OWNER_ID, projectId })).resolves.toBeNull();
    await setWebhook.execute({ adminUserId: OWNER_ID, projectId, url: WEBHOOK });

    await expect(getWebhook.execute({ adminUserId: OWNER_ID, projectId })).resolves.toEqual({
      hint: 'WXYZ',
      connectedAt: NOW,
      brokenAt: null,
      brokenReason: null,
    });
  });

  it('answers on any plan, so an account that left Pro still sees what is stored', async () => {
    const { setWebhook, getWebhook, accounts, account, projectId } = await setup();
    await setWebhook.execute({ adminUserId: OWNER_ID, projectId, url: WEBHOOK });
    accounts.add({ ...account, status: 'free' });

    await expect(getWebhook.execute({ adminUserId: OWNER_ID, projectId })).resolves.toMatchObject({
      hint: 'WXYZ',
    });
  });

  it('answers project_not_found to anyone but the owner', async () => {
    const { getWebhook, projectId } = await setup();

    await expect(getWebhook.execute({ adminUserId: MEMBER_ID, projectId })).rejects.toBeInstanceOf(
      ProjectNotFoundError,
    );
  });
});

describe('RemoveSlackWebhookUseCase', () => {
  it('removes the webhook on any plan', async () => {
    const { setWebhook, removeWebhook, webhooks, accounts, account, projectId } = await setup();
    await setWebhook.execute({ adminUserId: OWNER_ID, projectId, url: WEBHOOK });
    accounts.add({ ...account, status: 'free' });

    await removeWebhook.execute({ adminUserId: OWNER_ID, projectId });

    await expect(webhooks.statusOf(projectId)).resolves.toBeNull();
  });

  it('answers slack_webhook_not_found when there is none', async () => {
    const { removeWebhook, projectId } = await setup();

    await expect(
      removeWebhook.execute({ adminUserId: OWNER_ID, projectId }),
    ).rejects.toBeInstanceOf(SlackWebhookNotFoundError);
  });

  it('answers project_not_found to anyone but the owner', async () => {
    const { removeWebhook, projectId } = await setup();

    await expect(
      removeWebhook.execute({ adminUserId: MEMBER_ID, projectId }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });
});

describe('TestSlackWebhookUseCase', () => {
  it('posts the test message to the opened address, in the language of the admin', async () => {
    const { setWebhook, testWebhook, slack, projectId } = await setup();
    await setWebhook.execute({ adminUserId: OWNER_ID, projectId, url: WEBHOOK });

    await expect(
      testWebhook.execute({ adminUserId: OWNER_ID, projectId, language: 'pt-BR' }),
    ).resolves.toBe('sent');
    expect(slack.posted).toEqual([
      { webhookUrl: WEBHOOK, alert: null, projectName: 'Shop', language: 'pt-BR' },
    ]);
  });

  it('marks the webhook broken when Slack answers it no longer exists', async () => {
    const { setWebhook, testWebhook, slack, webhooks, projectId, clock } = await setup();
    await setWebhook.execute({ adminUserId: OWNER_ID, projectId, url: WEBHOOK });
    slack.answer(WEBHOOK, { outcome: 'gone', reason: 'x'.repeat(100) });
    clock.advanceBy(LATER.getTime() - NOW.getTime());

    await expect(
      testWebhook.execute({ adminUserId: OWNER_ID, projectId, language: 'en' }),
    ).resolves.toBe('broken');
    await expect(webhooks.statusOf(projectId)).resolves.toMatchObject({
      brokenAt: LATER,
      brokenReason: 'x'.repeat(MAX_SLACK_BROKEN_REASON_LENGTH),
    });
  });

  it('answers failed, and keeps the webhook working, when Slack cannot be reached', async () => {
    const { setWebhook, testWebhook, slack, webhooks, projectId } = await setup();
    await setWebhook.execute({ adminUserId: OWNER_ID, projectId, url: WEBHOOK });
    slack.answer(WEBHOOK, { outcome: 'failed', status: 500 });

    await expect(
      testWebhook.execute({ adminUserId: OWNER_ID, projectId, language: 'en' }),
    ).resolves.toBe('failed');
    await expect(webhooks.statusOf(projectId)).resolves.toMatchObject({ brokenAt: null });
  });

  it('answers slack_webhook_not_found when there is none', async () => {
    const { testWebhook, projectId } = await setup();

    await expect(
      testWebhook.execute({ adminUserId: OWNER_ID, projectId, language: 'en' }),
    ).rejects.toBeInstanceOf(SlackWebhookNotFoundError);
  });

  it('is Pro only, even with a webhook stored before the account left Pro', async () => {
    const { setWebhook, testWebhook, slack, accounts, account, projectId } = await setup();
    await setWebhook.execute({ adminUserId: OWNER_ID, projectId, url: WEBHOOK });
    accounts.add({ ...account, status: 'free' });

    await expect(
      testWebhook.execute({ adminUserId: OWNER_ID, projectId, language: 'en' }),
    ).rejects.toBeInstanceOf(PlanRequiredError);
    expect(slack.posted).toEqual([]);
  });

  it('answers project_not_found to anyone but the owner', async () => {
    const { testWebhook, projectId } = await setup();

    await expect(
      testWebhook.execute({ adminUserId: MEMBER_ID, projectId, language: 'en' }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });
});
