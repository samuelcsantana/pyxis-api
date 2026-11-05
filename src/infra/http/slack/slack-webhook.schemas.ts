import { z } from 'zod';
import {
  MAX_SLACK_WEBHOOK_LENGTH,
  type SlackWebhookStatus,
} from '../../../domain/slack/slack-webhook';

export const SLACK_WEBHOOK_MASK_PREFIX = 'hooks.slack.com/…/';

export const setSlackWebhookSchema = z
  .strictObject({
    url: z
      .string()
      .max(MAX_SLACK_WEBHOOK_LENGTH)
      .describe(
        'The Slack Incoming Webhook address, https://hooks.slack.com/services/…; no other host ' +
          'is accepted. Stored encrypted and never answered back',
      ),
  })
  .meta({ id: 'SetSlackWebhook' });

const slackWebhookShape = z.strictObject({
  masked_url: z
    .string()
    .describe('hooks.slack.com/…/ and the last four characters, enough to recognize it'),
  connected_at: z.iso.datetime(),
  broken_at: z.iso
    .datetime()
    .nullable()
    .describe('When Slack answered that the webhook no longer exists; null: it works'),
  broken_reason: z
    .string()
    .nullable()
    .describe('What Slack answered then, such as no_service or channel_not_found'),
});

export const slackWebhookSchema = z
  .strictObject({ webhook: slackWebhookShape.nullable().describe('null: no webhook is set') })
  .meta({
    id: 'SlackWebhook',
    description:
      'The Slack webhook the daily alerts of the project are posted to, masked. A broken one ' +
      'receives nothing until the owner pastes a working address.',
  });

export const slackTestSchema = z
  .strictObject({
    outcome: z
      .enum(['sent', 'broken', 'failed'])
      .describe(
        'sent: Slack accepted the test message; broken: Slack answered that the webhook no ' +
          'longer exists, and it is now marked broken; failed: Slack could not be reached, try ' +
          'again later',
      ),
  })
  .meta({ id: 'SlackTest' });

export type SetSlackWebhookBody = z.infer<typeof setSlackWebhookSchema>;
export type SlackWebhookBody = z.infer<typeof slackWebhookSchema>;
export type SlackTestBody = z.infer<typeof slackTestSchema>;

export function slackWebhookBody(status: SlackWebhookStatus | null): SlackWebhookBody {
  return {
    webhook:
      status === null
        ? null
        : {
            masked_url: `${SLACK_WEBHOOK_MASK_PREFIX}${status.hint}`,
            connected_at: status.connectedAt.toISOString(),
            broken_at: status.brokenAt?.toISOString() ?? null,
            broken_reason: status.brokenReason,
          },
  };
}
