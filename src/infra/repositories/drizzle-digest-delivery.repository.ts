import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type {
  DigestDelivery,
  DigestDeliveryRepository,
} from '../../domain/digest/digest-delivery.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { digestDeliveries } from '../database/schema/digest';

@Injectable()
export class DrizzleDigestDeliveryRepository implements DigestDeliveryRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async wasSent(delivery: DigestDelivery): Promise<boolean> {
    const sent = await this.db.$count(
      digestDeliveries,
      and(
        eq(digestDeliveries.projectId, delivery.projectId),
        eq(digestDeliveries.adminUserId, delivery.adminUserId),
        eq(digestDeliveries.weekStart, delivery.weekStart),
      ),
    );
    return sent > 0;
  }

  async recordSent(delivery: DigestDelivery, sentAt: Date): Promise<void> {
    await this.db
      .insert(digestDeliveries)
      .values({ ...delivery, sentAt })
      .onConflictDoNothing();
  }
}
