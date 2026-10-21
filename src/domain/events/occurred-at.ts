import { MAX_DELIVERY_DELAY_MS, MAX_OCCURRED_AT_AGE_MS } from './event-limits';

export function correctOccurredAt(occurredAt: Date, sentAt: Date, receivedAt: Date): Date {
  const skewMs = receivedAt.getTime() - sentAt.getTime();
  const corrected = isDeliveryDelay(skewMs) ? occurredAt.getTime() : occurredAt.getTime() + skewMs;
  const tooNew = corrected > receivedAt.getTime();
  const tooOld = corrected < receivedAt.getTime() - MAX_OCCURRED_AT_AGE_MS;
  return tooNew || tooOld ? receivedAt : new Date(corrected);
}

function isDeliveryDelay(skewMs: number): boolean {
  return skewMs >= 0 && skewMs < MAX_DELIVERY_DELAY_MS;
}
