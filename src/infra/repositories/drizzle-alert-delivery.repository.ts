import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { AlertDelivery, AlertDeliveryRepository } from '../../domain/alerts/alert-recipients';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { alertDeliveries } from '../database/schema/alerts';

@Injectable()
export class DrizzleAlertDeliveryRepository implements AlertDeliveryRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async wasSent(delivery: AlertDelivery): Promise<boolean> {
    const sent = await this.db.$count(
      alertDeliveries,
      and(
        eq(alertDeliveries.projectId, delivery.projectId),
        eq(alertDeliveries.adminUserId, delivery.adminUserId),
        eq(alertDeliveries.kind, delivery.kind),
        eq(alertDeliveries.day, delivery.day),
      ),
    );
    return sent > 0;
  }

  async recordSent(delivery: AlertDelivery, sentAt: Date): Promise<void> {
    await this.db
      .insert(alertDeliveries)
      .values({ ...delivery, sentAt })
      .onConflictDoNothing();
  }
}
