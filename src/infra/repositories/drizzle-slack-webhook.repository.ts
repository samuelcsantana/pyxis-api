import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type {
  SlackWebhookRepository,
  StoredSlackWebhook,
} from '../../domain/repositories/slack-webhook.repository';
import type {
  SlackAlertDelivery,
  SlackAlertDeliveryRepository,
} from '../../domain/slack/slack-destinations';
import type { SlackWebhookStatus } from '../../domain/slack/slack-webhook';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { insertedRow } from '../database/inserted-row';
import { projectSlackWebhooks, slackAlertDeliveries } from '../database/schema/slack';

const statusFields = {
  hint: projectSlackWebhooks.hint,
  connectedAt: projectSlackWebhooks.connectedAt,
  brokenAt: projectSlackWebhooks.brokenAt,
  brokenReason: projectSlackWebhooks.brokenReason,
};

@Injectable()
export class DrizzleSlackWebhookRepository implements SlackWebhookRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async save(
    projectId: string,
    webhook: StoredSlackWebhook,
    at: Date,
  ): Promise<SlackWebhookStatus> {
    const values = {
      sealedUrl: webhook.sealed,
      hint: webhook.hint,
      connectedAt: at,
      brokenAt: null,
      brokenReason: null,
    };
    return insertedRow(
      await this.db
        .insert(projectSlackWebhooks)
        .values({ projectId, ...values })
        .onConflictDoUpdate({ target: projectSlackWebhooks.projectId, set: values })
        .returning(statusFields),
    );
  }

  async statusOf(projectId: string): Promise<SlackWebhookStatus | null> {
    const [row] = await this.db
      .select(statusFields)
      .from(projectSlackWebhooks)
      .where(eq(projectSlackWebhooks.projectId, projectId))
      .limit(1);
    return row ?? null;
  }

  async sealedOf(projectId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ sealed: projectSlackWebhooks.sealedUrl })
      .from(projectSlackWebhooks)
      .where(eq(projectSlackWebhooks.projectId, projectId))
      .limit(1);
    return row?.sealed ?? null;
  }

  async remove(projectId: string): Promise<boolean> {
    const removed = await this.db
      .delete(projectSlackWebhooks)
      .where(eq(projectSlackWebhooks.projectId, projectId))
      .returning({ projectId: projectSlackWebhooks.projectId });
    return removed.length > 0;
  }

  async markBroken(projectId: string, reason: string, at: Date): Promise<void> {
    await this.db
      .update(projectSlackWebhooks)
      .set({ brokenAt: at, brokenReason: reason })
      .where(eq(projectSlackWebhooks.projectId, projectId));
  }
}

@Injectable()
export class DrizzleSlackAlertDeliveryRepository implements SlackAlertDeliveryRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async wasSent(delivery: SlackAlertDelivery): Promise<boolean> {
    const sent = await this.db.$count(
      slackAlertDeliveries,
      and(
        eq(slackAlertDeliveries.projectId, delivery.projectId),
        eq(slackAlertDeliveries.kind, delivery.kind),
        eq(slackAlertDeliveries.day, delivery.day),
      ),
    );
    return sent > 0;
  }

  async recordSent(delivery: SlackAlertDelivery, sentAt: Date): Promise<void> {
    await this.db
      .insert(slackAlertDeliveries)
      .values({ ...delivery, sentAt })
      .onConflictDoNothing();
  }
}
