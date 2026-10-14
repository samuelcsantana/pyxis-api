export interface ReceivedBillingEvent {
  readonly id: string;
  readonly type: string;
}

export interface BillingEventRepository {
  claim(event: ReceivedBillingEvent, at: Date): Promise<boolean>;
  complete(eventId: string, at: Date): Promise<void>;
}

export const BILLING_EVENT_REPOSITORY = Symbol('BillingEventRepository');
