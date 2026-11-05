import type { AlertRecipient, AlertRecipientsQuery } from '../domain/alerts/alert-recipients';

export class StubAlertRecipientsQuery implements AlertRecipientsQuery {
  constructor(private readonly found: readonly AlertRecipient[]) {}

  recipients(): Promise<readonly AlertRecipient[]> {
    return Promise.resolve(this.found);
  }
}
