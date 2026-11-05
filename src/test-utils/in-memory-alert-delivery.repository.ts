import type { AlertDelivery, AlertDeliveryRepository } from '../domain/alerts/alert-recipients';

function keyOf(delivery: AlertDelivery): string {
  return [delivery.projectId, delivery.adminUserId, delivery.kind, delivery.day].join(':');
}

export class InMemoryAlertDeliveryRepository implements AlertDeliveryRepository {
  private readonly sent = new Map<string, Date>();

  get recorded(): readonly string[] {
    return [...this.sent.keys()];
  }

  wasSent(delivery: AlertDelivery): Promise<boolean> {
    return Promise.resolve(this.sent.has(keyOf(delivery)));
  }

  recordSent(delivery: AlertDelivery, sentAt: Date): Promise<void> {
    this.sent.set(keyOf(delivery), sentAt);
    return Promise.resolve();
  }
}
