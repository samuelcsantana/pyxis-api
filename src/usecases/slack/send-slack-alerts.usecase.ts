import { Inject, Injectable, Logger } from '@nestjs/common';
import { mayUseProFeatures } from '../../domain/accounts/pro-features';
import { mayAlert } from '../../domain/alerts/alert-rules';
import { ALERT_KINDS, type AlertKind, type ProjectAlert } from '../../domain/alerts/project-alert';
import { todayIn } from '../../domain/queries/date-range';
import { CLOCK, type Clock } from '../../domain/services/clock';
import { SECRET_BOX, type SecretBox } from '../../domain/services/secret-box';
import {
  SLACK_ALERT_DELIVERY_REPOSITORY,
  SLACK_DESTINATIONS_QUERY,
  type SlackAlertDelivery,
  type SlackAlertDeliveryRepository,
  type SlackDestination,
  type SlackDestinationsQuery,
} from '../../domain/slack/slack-destinations';
import {
  SLACK_SENDER,
  type SlackDelivery,
  type SlackSender,
} from '../../domain/slack/slack-sender';
import { brokenReasonOf, slackWebhookContext } from '../../domain/slack/slack-webhook';
import {
  SLACK_WEBHOOK_REPOSITORY,
  type SlackWebhookRepository,
} from '../../domain/repositories/slack-webhook.repository';
import { DetectProjectAlertsUseCase } from '../alerts/detect-project-alerts.usecase';

const DELIVERY_DAY_ZONE = 'UTC';
const EVERY_ALERT_KIND: ReadonlySet<AlertKind> = new Set(ALERT_KINDS);

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface SlackAlertsReport {
  readonly projects: number;
  readonly raised: number;
  readonly sent: number;
  readonly alreadySent: number;
  readonly failed: number;
  readonly broken: number;
  readonly failedProjects: number;
}

type PostOutcome = 'sent' | 'already_sent' | 'failed' | 'broken';

interface ProjectOutcome {
  readonly raised: number;
  readonly posts: readonly PostOutcome[];
  readonly detected: boolean;
}

function reportOf(outcomes: readonly ProjectOutcome[]): SlackAlertsReport {
  const posts = outcomes.flatMap((outcome) => outcome.posts);
  const count = (wanted: PostOutcome) => posts.filter((each) => each === wanted).length;
  return {
    projects: outcomes.length,
    raised: outcomes.reduce((total, outcome) => total + outcome.raised, 0),
    sent: count('sent'),
    alreadySent: count('already_sent'),
    failed: count('failed'),
    broken: count('broken'),
    failedProjects: outcomes.filter((outcome) => !outcome.detected).length,
  };
}

@Injectable()
export class SendSlackAlertsUseCase {
  private readonly logger = new Logger(SendSlackAlertsUseCase.name);

  constructor(
    @Inject(SLACK_DESTINATIONS_QUERY) private readonly destinations: SlackDestinationsQuery,
    @Inject(SLACK_ALERT_DELIVERY_REPOSITORY)
    private readonly deliveries: SlackAlertDeliveryRepository,
    @Inject(SLACK_WEBHOOK_REPOSITORY) private readonly webhooks: SlackWebhookRepository,
    private readonly detectAlerts: DetectProjectAlertsUseCase,
    @Inject(SECRET_BOX) private readonly box: SecretBox,
    @Inject(SLACK_SENDER) private readonly slack: SlackSender,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(): Promise<SlackAlertsReport> {
    const now = this.clock.now();
    const eligible = (await this.destinations.destinations()).filter(
      (destination) =>
        mayUseProFeatures(destination.account) &&
        mayAlert(destination.account, destination.ingestionSuspended, now),
    );
    const day = todayIn(DELIVERY_DAY_ZONE, now);
    const outcomes: ProjectOutcome[] = [];
    for (const destination of eligible) {
      outcomes.push(await this.alertProject(destination, day, now));
    }
    const report = reportOf(outcomes);
    this.logger.log({ message: 'slack_alerts.completed', ...report });
    return report;
  }

  private async alertProject(
    destination: SlackDestination,
    day: string,
    now: Date,
  ): Promise<ProjectOutcome> {
    const alerts = await this.tryDetect(destination, now);
    if (alerts === null) {
      return { raised: 0, posts: [], detected: false };
    }
    const url = alerts.length === 0 ? null : this.tryOpen(destination);
    const posts: PostOutcome[] = [];
    for (const alert of alerts) {
      const outcome = await this.post(destination, url, alert, day);
      posts.push(outcome);
      if (outcome === 'broken') {
        break;
      }
    }
    return { raised: alerts.length, posts, detected: true };
  }

  private async tryDetect(
    destination: SlackDestination,
    now: Date,
  ): Promise<readonly ProjectAlert[] | null> {
    try {
      return await this.detectAlerts.execute(destination.project, EVERY_ALERT_KIND, now);
    } catch (error) {
      this.logger.error({
        message: 'slack_alerts.detection_failed',
        projectId: destination.project.id,
        error: reasonOf(error),
      });
      return null;
    }
  }

  private tryOpen(destination: SlackDestination): string | null {
    try {
      return this.box.open(destination.sealedWebhook, slackWebhookContext(destination.project.id));
    } catch (error) {
      this.logger.error({
        message: 'slack_alerts.webhook_unreadable',
        projectId: destination.project.id,
        error: reasonOf(error),
      });
      return null;
    }
  }

  private async post(
    destination: SlackDestination,
    url: string | null,
    alert: ProjectAlert,
    day: string,
  ): Promise<PostOutcome> {
    const delivery: SlackAlertDelivery = {
      projectId: destination.project.id,
      kind: alert.kind,
      day,
    };
    if (await this.deliveries.wasSent(delivery)) {
      return 'already_sent';
    }
    if (url === null) {
      return 'failed';
    }
    const posted = await this.tryPost(url, alert, destination);
    switch (posted.outcome) {
      case 'sent':
        await this.deliveries.recordSent(delivery, this.clock.now());
        this.logger.log({ message: 'slack_alerts.sent', ...delivery });
        return 'sent';
      case 'gone':
        await this.webhooks.markBroken(
          delivery.projectId,
          brokenReasonOf(posted.reason),
          this.clock.now(),
        );
        this.logger.warn({ message: 'slack_alerts.webhook_broken', ...delivery });
        return 'broken';
      case 'failed':
        this.logger.error({
          message: 'slack_alerts.delivery_failed',
          ...delivery,
          status: posted.status,
        });
        return 'failed';
    }
  }

  private async tryPost(
    url: string,
    alert: ProjectAlert,
    destination: SlackDestination,
  ): Promise<SlackDelivery> {
    try {
      return await this.slack.postAlert(url, alert, destination.ownerLanguage);
    } catch (error) {
      this.logger.error({
        message: 'slack_alerts.post_threw',
        projectId: destination.project.id,
        error: reasonOf(error),
      });
      return { outcome: 'failed', status: null };
    }
  }
}
