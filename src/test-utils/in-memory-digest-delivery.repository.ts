import type {
  DigestDelivery,
  DigestDeliveryRepository,
} from '../domain/digest/digest-delivery.repository';

export interface SentDigest extends DigestDelivery {
  readonly sentAt: Date;
}

function sameDelivery(left: DigestDelivery, right: DigestDelivery): boolean {
  return (
    left.projectId === right.projectId &&
    left.adminUserId === right.adminUserId &&
    left.weekStart === right.weekStart
  );
}

export class InMemoryDigestDeliveryRepository implements DigestDeliveryRepository {
  sent: readonly SentDigest[] = [];

  wasSent(delivery: DigestDelivery): Promise<boolean> {
    return Promise.resolve(this.sent.some((sent) => sameDelivery(sent, delivery)));
  }

  async recordSent(delivery: DigestDelivery, sentAt: Date): Promise<void> {
    if (!(await this.wasSent(delivery))) {
      this.sent = [...this.sent, { ...delivery, sentAt }];
    }
  }
}
