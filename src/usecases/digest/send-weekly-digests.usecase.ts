import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  DIGEST_DELIVERY_REPOSITORY,
  type DigestDelivery,
  type DigestDeliveryRepository,
} from '../../domain/digest/digest-delivery.repository';
import {
  DIGEST_RECIPIENTS_QUERY,
  type DigestRecipient,
  type DigestRecipientsQuery,
} from '../../domain/digest/digest-recipients';
import { lastClosedWeek } from '../../domain/digest/digest-week';
import type { WeeklyDigest } from '../../domain/digest/weekly-digest';
import type { Project } from '../../domain/entities/project.entity';
import type { DateRange } from '../../domain/queries/date-range';
import { CLOCK, type Clock } from '../../domain/services/clock';
import { MAIL_SENDER, type MailSender } from '../../domain/services/mail-sender';
import { BuildWeeklyDigestUseCase } from './build-weekly-digest.usecase';

export interface DigestReport {
  readonly sent: number;
  readonly alreadySent: number;
  readonly failed: number;
}

type DeliveryOutcome = 'sent' | 'already_sent' | 'failed';

function reportOf(outcomes: readonly DeliveryOutcome[]): DigestReport {
  const count = (outcome: DeliveryOutcome) => outcomes.filter((each) => each === outcome).length;
  return { sent: count('sent'), alreadySent: count('already_sent'), failed: count('failed') };
}

@Injectable()
export class SendWeeklyDigestsUseCase {
  private readonly logger = new Logger(SendWeeklyDigestsUseCase.name);

  constructor(
    @Inject(DIGEST_RECIPIENTS_QUERY) private readonly recipients: DigestRecipientsQuery,
    @Inject(DIGEST_DELIVERY_REPOSITORY) private readonly deliveries: DigestDeliveryRepository,
    private readonly buildDigest: BuildWeeklyDigestUseCase,
    @Inject(MAIL_SENDER) private readonly mail: MailSender,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(): Promise<DigestReport> {
    const now = this.clock.now();
    const digests = new Map<string, Promise<WeeklyDigest>>();
    const outcomes: DeliveryOutcome[] = [];
    for (const recipient of await this.recipients.recipients()) {
      const week = lastClosedWeek(now, recipient.project.timezone);
      outcomes.push(await this.deliverTo(recipient, week, digests));
    }
    const report = reportOf(outcomes);
    this.logger.log({ message: 'digest.completed', ...report });
    return report;
  }

  private async deliverTo(
    recipient: DigestRecipient,
    week: DateRange,
    digests: Map<string, Promise<WeeklyDigest>>,
  ): Promise<DeliveryOutcome> {
    const delivery: DigestDelivery = {
      projectId: recipient.project.id,
      adminUserId: recipient.adminUserId,
      weekStart: week.from,
    };
    if (await this.deliveries.wasSent(delivery)) {
      return 'already_sent';
    }
    const digest = await this.digestOf(recipient.project, week, digests);
    if (!(await this.tryDeliverDigest(recipient, digest, delivery))) {
      return 'failed';
    }
    await this.deliveries.recordSent(delivery, this.clock.now());
    return 'sent';
  }

  private digestOf(
    project: Project,
    week: DateRange,
    digests: Map<string, Promise<WeeklyDigest>>,
  ): Promise<WeeklyDigest> {
    const key = `${project.id}:${week.from}`;
    const known = digests.get(key);
    if (known !== undefined) {
      return known;
    }
    const built = this.buildDigest.execute(project, week);
    digests.set(key, built);
    return built;
  }

  private async tryDeliverDigest(
    recipient: DigestRecipient,
    digest: WeeklyDigest,
    delivery: DigestDelivery,
  ): Promise<boolean> {
    try {
      await this.mail.sendWeeklyDigest(recipient.email, digest, recipient.emailLanguage);
      this.logger.log({ message: 'digest.sent', ...delivery });
      return true;
    } catch (error) {
      this.logger.error({
        message: 'digest.delivery_failed',
        ...delivery,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}
