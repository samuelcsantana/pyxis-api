import { DomainError } from './domain.error';

export class BillingUnavailableError extends DomainError {
  readonly code = 'billing_unavailable';

  constructor(readonly reason: string) {
    super('Billing is not available right now; try again later.');
  }
}

export class InvalidBillingSignatureError extends DomainError {
  readonly code = 'invalid_billing_signature';

  constructor() {
    super('The billing event is not signed by the billing provider.');
  }
}
