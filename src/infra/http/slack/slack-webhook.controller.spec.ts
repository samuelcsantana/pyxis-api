import type { FastifyRequest } from 'fastify';
import type { AdminUser } from '../../../domain/entities/admin-user.entity';
import type { SlackWebhookStatus } from '../../../domain/slack/slack-webhook';
import type { GetSlackWebhookUseCase } from '../../../usecases/slack/get-slack-webhook.usecase';
import type { RemoveSlackWebhookUseCase } from '../../../usecases/slack/remove-slack-webhook.usecase';
import type { SetSlackWebhookUseCase } from '../../../usecases/slack/set-slack-webhook.usecase';
import type { TestSlackWebhookUseCase } from '../../../usecases/slack/test-slack-webhook.usecase';
import { SlackWebhookController } from './slack-webhook.controller';
import {
  setSlackWebhookSchema,
  slackTestSchema,
  slackWebhookBody,
  slackWebhookSchema,
} from './slack-webhook.schemas';

const PROJECT_ID = '6f1d3c2a-8b4e-4f7a-9c1d-2e3f4a5b6c7d';
const WEBHOOK = 'https://hooks.slack.com/services/T0001/B0002/abcdefghijklWXYZ';
const ADMIN: AdminUser = {
  id: '3e0b4f5a-6c7d-4e8f-9a0b-1c2d3e4f5a6b',
  email: 'ana@example.com',
  emailLanguage: 'fr',
  suspendedAt: null,
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
};
const STATUS: SlackWebhookStatus = {
  hint: 'WXYZ',
  connectedAt: new Date('2026-11-05T12:00:00.000Z'),
  brokenAt: null,
  brokenReason: null,
};
const STATUS_BODY = {
  webhook: {
    masked_url: 'hooks.slack.com/…/WXYZ',
    connected_at: '2026-11-05T12:00:00.000Z',
    broken_at: null,
    broken_reason: null,
  },
};
const REQUEST = { admin: ADMIN } as unknown as FastifyRequest;

function recording<T>(answer: T) {
  const calls: unknown[][] = [];
  return {
    calls,
    useCase: {
      execute: (...args: unknown[]) => {
        calls.push(args);
        return Promise.resolve(answer);
      },
    },
  };
}

function controllerAnswering(status: SlackWebhookStatus | null = STATUS) {
  const get = recording(status);
  const set = recording(STATUS);
  const remove = recording(undefined);
  const test = recording('sent');
  return {
    get,
    set,
    remove,
    test,
    controller: new SlackWebhookController(
      get.useCase as unknown as GetSlackWebhookUseCase,
      set.useCase as unknown as SetSlackWebhookUseCase,
      remove.useCase as unknown as RemoveSlackWebhookUseCase,
      test.useCase as unknown as TestSlackWebhookUseCase,
    ),
  };
}

describe('SlackWebhookController', () => {
  it('answers the masked webhook of the project for the signed-in admin', async () => {
    const { controller, get } = controllerAnswering();

    const body = await controller.show(REQUEST, PROJECT_ID);

    expect(body).toEqual(STATUS_BODY);
    expect(slackWebhookSchema.parse(body)).toEqual(body);
    expect(get.calls).toEqual([[{ adminUserId: ADMIN.id, projectId: PROJECT_ID }]]);
  });

  it('answers null when the project has no webhook', async () => {
    const { controller } = controllerAnswering(null);

    await expect(controller.show(REQUEST, PROJECT_ID)).resolves.toEqual({ webhook: null });
  });

  it('sets the webhook and answers it masked, never the address', async () => {
    const { controller, set } = controllerAnswering();

    const body = await controller.set(REQUEST, PROJECT_ID, { url: WEBHOOK });

    expect(body).toEqual(STATUS_BODY);
    expect(JSON.stringify(body)).not.toContain('abcdefghijkl');
    expect(set.calls).toEqual([[{ adminUserId: ADMIN.id, projectId: PROJECT_ID, url: WEBHOOK }]]);
  });

  it('removes the webhook', async () => {
    const { controller, remove } = controllerAnswering();

    await expect(controller.remove(REQUEST, PROJECT_ID)).resolves.toBeUndefined();
    expect(remove.calls).toEqual([[{ adminUserId: ADMIN.id, projectId: PROJECT_ID }]]);
  });

  it('tests the webhook in the language of the admin', async () => {
    const { controller, test } = controllerAnswering();

    const body = await controller.test(REQUEST, PROJECT_ID);

    expect(body).toEqual({ outcome: 'sent' });
    expect(slackTestSchema.parse(body)).toEqual(body);
    expect(test.calls).toEqual([
      [{ adminUserId: ADMIN.id, projectId: PROJECT_ID, language: 'fr' }],
    ]);
  });
});

describe('the Slack webhook schemas', () => {
  it('answers when and why a broken webhook stopped', () => {
    expect(
      slackWebhookBody({
        ...STATUS,
        brokenAt: new Date('2026-11-06T06:00:00.000Z'),
        brokenReason: 'no_service',
      }).webhook,
    ).toMatchObject({ broken_at: '2026-11-06T06:00:00.000Z', broken_reason: 'no_service' });
  });

  it('takes only the address, no longer than a webhook can be', () => {
    expect(setSlackWebhookSchema.safeParse({ url: WEBHOOK }).success).toBe(true);
    expect(setSlackWebhookSchema.safeParse({ url: WEBHOOK, channel: '#x' }).success).toBe(false);
    expect(setSlackWebhookSchema.safeParse({ url: 'x'.repeat(257) }).success).toBe(false);
  });
});
