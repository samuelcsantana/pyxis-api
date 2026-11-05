import type { ProjectAlert } from '../domain/alerts/project-alert';
import type { EmailLanguage } from '../domain/auth/email-language';
import type {
  SlackWebhookRepository,
  StoredSlackWebhook,
} from '../domain/repositories/slack-webhook.repository';
import type { SecretBox } from '../domain/services/secret-box';
import type {
  SlackAlertDelivery,
  SlackAlertDeliveryRepository,
  SlackDestination,
  SlackDestinationsQuery,
} from '../domain/slack/slack-destinations';
import type { SlackDelivery, SlackSender } from '../domain/slack/slack-sender';
import type { SlackWebhookStatus } from '../domain/slack/slack-webhook';

interface StoredWebhook {
  readonly sealed: string;
  readonly status: SlackWebhookStatus;
}

export class InMemorySlackWebhookRepository implements SlackWebhookRepository {
  private readonly webhooks = new Map<string, StoredWebhook>();

  save(projectId: string, webhook: StoredSlackWebhook, at: Date): Promise<SlackWebhookStatus> {
    const status: SlackWebhookStatus = {
      hint: webhook.hint,
      connectedAt: at,
      brokenAt: null,
      brokenReason: null,
    };
    this.webhooks.set(projectId, { sealed: webhook.sealed, status });
    return Promise.resolve(status);
  }

  statusOf(projectId: string): Promise<SlackWebhookStatus | null> {
    return Promise.resolve(this.webhooks.get(projectId)?.status ?? null);
  }

  sealedOf(projectId: string): Promise<string | null> {
    return Promise.resolve(this.webhooks.get(projectId)?.sealed ?? null);
  }

  remove(projectId: string): Promise<boolean> {
    return Promise.resolve(this.webhooks.delete(projectId));
  }

  markBroken(projectId: string, reason: string, at: Date): Promise<void> {
    const stored = this.webhooks.get(projectId);
    if (stored !== undefined) {
      this.webhooks.set(projectId, {
        ...stored,
        status: { ...stored.status, brokenAt: at, brokenReason: reason },
      });
    }
    return Promise.resolve();
  }
}

export class InMemorySlackAlertDeliveryRepository implements SlackAlertDeliveryRepository {
  private readonly sent = new Set<string>();

  get recorded(): readonly string[] {
    return [...this.sent];
  }

  wasSent(delivery: SlackAlertDelivery): Promise<boolean> {
    return Promise.resolve(this.sent.has(keyOf(delivery)));
  }

  recordSent(delivery: SlackAlertDelivery): Promise<void> {
    this.sent.add(keyOf(delivery));
    return Promise.resolve();
  }
}

function keyOf(delivery: SlackAlertDelivery): string {
  return [delivery.projectId, delivery.kind, delivery.day].join(':');
}

export class StubSlackDestinationsQuery implements SlackDestinationsQuery {
  constructor(private readonly found: readonly SlackDestination[]) {}

  destinations(): Promise<readonly SlackDestination[]> {
    return Promise.resolve(this.found);
  }
}

export const FAKE_SEAL_PREFIX = 'sealed:';

export class FakeSecretBox implements SecretBox {
  seal(plain: string, context: string): string {
    return `${FAKE_SEAL_PREFIX}${context}:${plain}`;
  }

  open(sealed: string, context: string): string {
    const prefix = `${FAKE_SEAL_PREFIX}${context}:`;
    if (!sealed.startsWith(prefix)) {
      throw new Error('The sealed value belongs to another context.');
    }
    return sealed.slice(prefix.length);
  }
}

export interface PostedToSlack {
  readonly webhookUrl: string;
  readonly alert: ProjectAlert | null;
  readonly projectName: string | null;
  readonly language: EmailLanguage;
}

export class RecordingSlackSender implements SlackSender {
  readonly posted: PostedToSlack[] = [];
  private readonly answers = new Map<string, SlackDelivery>();

  answer(webhookUrl: string, delivery: SlackDelivery): void {
    this.answers.set(webhookUrl, delivery);
  }

  postAlert(
    webhookUrl: string,
    alert: ProjectAlert,
    language: EmailLanguage,
  ): Promise<SlackDelivery> {
    this.posted.push({ webhookUrl, alert, projectName: null, language });
    return Promise.resolve(this.answerFor(webhookUrl));
  }

  postTest(
    webhookUrl: string,
    projectName: string,
    language: EmailLanguage,
  ): Promise<SlackDelivery> {
    this.posted.push({ webhookUrl, alert: null, projectName, language });
    return Promise.resolve(this.answerFor(webhookUrl));
  }

  private answerFor(webhookUrl: string): SlackDelivery {
    return this.answers.get(webhookUrl) ?? { outcome: 'sent' };
  }
}
