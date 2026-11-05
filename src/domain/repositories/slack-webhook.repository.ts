import type { SlackWebhookStatus } from '../slack/slack-webhook';

export interface StoredSlackWebhook {
  readonly sealed: string;
  readonly hint: string;
}

export interface SlackWebhookRepository {
  save(projectId: string, webhook: StoredSlackWebhook, at: Date): Promise<SlackWebhookStatus>;
  statusOf(projectId: string): Promise<SlackWebhookStatus | null>;
  sealedOf(projectId: string): Promise<string | null>;
  remove(projectId: string): Promise<boolean>;
  markBroken(projectId: string, reason: string, at: Date): Promise<void>;
}

export const SLACK_WEBHOOK_REPOSITORY = Symbol('SlackWebhookRepository');
