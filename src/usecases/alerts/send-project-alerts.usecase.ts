import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ALERT_DELIVERY_REPOSITORY,
  ALERT_RECIPIENTS_QUERY,
  type AlertDelivery,
  type AlertDeliveryRepository,
  type AlertRecipient,
  type AlertRecipientsQuery,
} from '../../domain/alerts/alert-recipients';
import { mayAlert } from '../../domain/alerts/alert-rules';
import type { AlertKind, ProjectAlert } from '../../domain/alerts/project-alert';
import { todayIn } from '../../domain/queries/date-range';
import { CLOCK, type Clock } from '../../domain/services/clock';
import { MAIL_SENDER, type MailSender } from '../../domain/services/mail-sender';
import { DetectProjectAlertsUseCase } from './detect-project-alerts.usecase';

const DELIVERY_DAY_ZONE = 'UTC';

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface AlertsReport {
  readonly projects: number;
  readonly raised: number;
  readonly sent: number;
  readonly alreadySent: number;
  readonly failed: number;
  readonly failedProjects: number;
}

type DeliveryOutcome = 'sent' | 'already_sent' | 'failed';

interface ProjectOutcome {
  readonly raised: number;
  readonly deliveries: readonly DeliveryOutcome[];
  readonly detected: boolean;
}

type RecipientGroup = readonly [AlertRecipient, ...AlertRecipient[]];

function byProject(recipients: readonly AlertRecipient[]): readonly RecipientGroup[] {
  const groups = new Map<string, RecipientGroup>();
  for (const recipient of recipients) {
    const group = groups.get(recipient.project.id);
    groups.set(recipient.project.id, group === undefined ? [recipient] : [...group, recipient]);
  }
  return [...groups.values()];
}

function reportOf(outcomes: readonly ProjectOutcome[]): AlertsReport {
  const deliveries = outcomes.flatMap((outcome) => outcome.deliveries);
  const count = (wanted: DeliveryOutcome) => deliveries.filter((each) => each === wanted).length;
  return {
    projects: outcomes.length,
    raised: outcomes.reduce((total, outcome) => total + outcome.raised, 0),
    sent: count('sent'),
    alreadySent: count('already_sent'),
    failed: count('failed'),
    failedProjects: outcomes.filter((outcome) => !outcome.detected).length,
  };
}

@Injectable()
export class SendProjectAlertsUseCase {
  private readonly logger = new Logger(SendProjectAlertsUseCase.name);

  constructor(
    @Inject(ALERT_RECIPIENTS_QUERY) private readonly recipients: AlertRecipientsQuery,
    @Inject(ALERT_DELIVERY_REPOSITORY) private readonly deliveries: AlertDeliveryRepository,
    private readonly detectAlerts: DetectProjectAlertsUseCase,
    @Inject(MAIL_SENDER) private readonly mail: MailSender,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(): Promise<AlertsReport> {
    const now = this.clock.now();
    const eligible = (await this.recipients.recipients()).filter((recipient) =>
      mayAlert(recipient.account, recipient.ingestionSuspended, now),
    );
    const outcomes: ProjectOutcome[] = [];
    for (const group of byProject(eligible)) {
      outcomes.push(await this.alertProject(group, now));
    }
    const report = reportOf(outcomes);
    this.logger.log({ message: 'alerts.completed', ...report });
    return report;
  }

  private async alertProject(group: RecipientGroup, now: Date): Promise<ProjectOutcome> {
    const alerts = await this.tryDetect(group, now);
    if (alerts === null) {
      return { raised: 0, deliveries: [], detected: false };
    }
    const day = todayIn(DELIVERY_DAY_ZONE, now);
    const deliveries: DeliveryOutcome[] = [];
    for (const recipient of group) {
      for (const alert of alerts.filter(({ kind }) => recipient.kinds.includes(kind))) {
        deliveries.push(await this.deliver(recipient, alert, day));
      }
    }
    return { raised: alerts.length, deliveries, detected: true };
  }

  private async tryDetect(
    group: RecipientGroup,
    now: Date,
  ): Promise<readonly ProjectAlert[] | null> {
    const [first] = group;
    const kinds = new Set<AlertKind>(group.flatMap((recipient) => recipient.kinds));
    try {
      return await this.detectAlerts.execute(first.project, kinds, now);
    } catch (error) {
      this.logger.error({
        message: 'alerts.detection_failed',
        projectId: first.project.id,
        error: reasonOf(error),
      });
      return null;
    }
  }

  private async deliver(
    recipient: AlertRecipient,
    alert: ProjectAlert,
    day: string,
  ): Promise<DeliveryOutcome> {
    const delivery: AlertDelivery = {
      projectId: alert.projectId,
      adminUserId: recipient.adminUserId,
      kind: alert.kind,
      day,
    };
    if (await this.deliveries.wasSent(delivery)) {
      return 'already_sent';
    }
    if (!(await this.tryDeliverAlert(recipient, alert, delivery))) {
      return 'failed';
    }
    await this.deliveries.recordSent(delivery, this.clock.now());
    return 'sent';
  }

  private async tryDeliverAlert(
    recipient: AlertRecipient,
    alert: ProjectAlert,
    delivery: AlertDelivery,
  ): Promise<boolean> {
    try {
      await this.mail.sendProjectAlert(recipient.email, alert, recipient.emailLanguage);
      this.logger.log({ message: 'alerts.sent', ...delivery });
      return true;
    } catch (error) {
      this.logger.error({
        message: 'alerts.delivery_failed',
        ...delivery,
        error: reasonOf(error),
      });
      return false;
    }
  }
}
