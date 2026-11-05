import { InvalidSlackWebhookError } from '../errors/slack.errors';

export const SLACK_WEBHOOK_PATTERN =
  /^https:\/\/hooks\.slack\.com\/services\/[A-Z0-9]{2,32}\/[A-Z0-9]{2,32}\/[A-Za-z0-9]{8,64}$/;
export const MAX_SLACK_WEBHOOK_LENGTH = 256;
export const SLACK_WEBHOOK_HINT_LENGTH = 4;
export const MAX_SLACK_BROKEN_REASON_LENGTH = 64;

export interface SlackWebhookStatus {
  readonly hint: string;
  readonly connectedAt: Date;
  readonly brokenAt: Date | null;
  readonly brokenReason: string | null;
}

export function isSlackWebhookUrl(candidate: string): boolean {
  return candidate.length <= MAX_SLACK_WEBHOOK_LENGTH && SLACK_WEBHOOK_PATTERN.test(candidate);
}

export function requireSlackWebhookUrl(candidate: string): string {
  const url = candidate.trim();
  if (!isSlackWebhookUrl(url)) {
    throw new InvalidSlackWebhookError();
  }
  return url;
}

export function slackWebhookHint(url: string): string {
  return url.slice(-SLACK_WEBHOOK_HINT_LENGTH);
}

export function brokenReasonOf(reason: string): string {
  return reason.slice(0, MAX_SLACK_BROKEN_REASON_LENGTH);
}

export function slackWebhookContext(projectId: string): string {
  return `slack-webhook:${projectId}`;
}
