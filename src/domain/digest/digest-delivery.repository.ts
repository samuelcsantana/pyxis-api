export interface DigestDelivery {
  readonly projectId: string;
  readonly adminUserId: string;
  readonly weekStart: string;
}

export interface DigestDeliveryRepository {
  wasSent(delivery: DigestDelivery): Promise<boolean>;
  recordSent(delivery: DigestDelivery, sentAt: Date): Promise<void>;
}

export const DIGEST_DELIVERY_REPOSITORY = Symbol('DigestDeliveryRepository');
