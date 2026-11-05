import { Logger } from '@nestjs/common';
import type { ProjectAlert } from '../../domain/alerts/project-alert';
import type { EmailLanguage } from '../../domain/auth/email-language';
import type { SlackDelivery, SlackSender } from '../../domain/slack/slack-sender';
import { isSlackWebhookUrl } from '../../domain/slack/slack-webhook';
import { type EmailLinks, emailLinksFor } from '../mail/email-layout';
import { summarizeProjectAlert } from '../mail/project-alert-email';
import { SLACK_MESSAGES } from './slack-messages';

export const SLACK_TIMEOUT_MS = 10_000;

const GONE_STATUSES: ReadonlySet<number> = new Set([404, 410]);

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

interface SlackMessage {
  readonly text: string;
  readonly blocks: readonly object[];
}

export function escapeSlackText(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function section(markdown: string): object {
  return { type: 'section', text: { type: 'mrkdwn', text: markdown } };
}

export function slackAlertMessage(
  alert: ProjectAlert,
  language: EmailLanguage,
  links: EmailLinks,
): SlackMessage {
  const summary = summarizeProjectAlert(alert, language, links);
  return {
    text: summary.subject,
    blocks: [
      section(
        `*${escapeSlackText(summary.subject)}*\n${escapeSlackText(summary.body)}\n` +
          escapeSlackText(summary.hint),
      ),
      section(`<${summary.url}|${escapeSlackText(summary.button)}>`),
    ],
  };
}

export function slackTestMessage(projectName: string, language: EmailLanguage): SlackMessage {
  const text = SLACK_MESSAGES[language].connected(projectName);
  return { text, blocks: [section(escapeSlackText(text))] };
}

async function reasonOf(response: Response): Promise<string> {
  const body = await response.text().catch(() => '');
  return body.trim() === '' ? String(response.status) : body.trim();
}

export class HttpSlackSender implements SlackSender {
  constructor(
    private readonly links: EmailLinks,
    private readonly send: FetchLike = fetch,
  ) {}

  postAlert(
    webhookUrl: string,
    alert: ProjectAlert,
    language: EmailLanguage,
  ): Promise<SlackDelivery> {
    return this.post(webhookUrl, slackAlertMessage(alert, language, this.links));
  }

  postTest(
    webhookUrl: string,
    projectName: string,
    language: EmailLanguage,
  ): Promise<SlackDelivery> {
    return this.post(webhookUrl, slackTestMessage(projectName, language));
  }

  private async post(webhookUrl: string, message: SlackMessage): Promise<SlackDelivery> {
    if (!isSlackWebhookUrl(webhookUrl)) {
      return { outcome: 'failed', status: null };
    }
    let response: Response;
    try {
      response = await this.send(webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(message),
        redirect: 'error',
        signal: AbortSignal.timeout(SLACK_TIMEOUT_MS),
      });
    } catch {
      return { outcome: 'failed', status: null };
    }
    if (response.ok) {
      return { outcome: 'sent' };
    }
    if (GONE_STATUSES.has(response.status)) {
      return { outcome: 'gone', reason: await reasonOf(response) };
    }
    return { outcome: 'failed', status: response.status };
  }
}

export class UnconfiguredSlackSender implements SlackSender {
  private readonly logger = new Logger(UnconfiguredSlackSender.name);

  postAlert(): Promise<SlackDelivery> {
    return Promise.resolve(this.refuse());
  }

  postTest(): Promise<SlackDelivery> {
    return Promise.resolve(this.refuse());
  }

  private refuse(): SlackDelivery {
    this.logger.error({ message: 'slack.dashboard_origin_missing' });
    return { outcome: 'failed', status: null };
  }
}

export function createSlackSender(dashboardOrigin: string | undefined): SlackSender {
  return dashboardOrigin === undefined
    ? new UnconfiguredSlackSender()
    : new HttpSlackSender(emailLinksFor(dashboardOrigin));
}
