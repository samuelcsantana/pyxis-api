import { DomainError } from './domain.error';

export class AccountNotFoundError extends DomainError {
  readonly code = 'account_not_found';

  constructor() {
    super('No account has this id.');
  }
}

export class ProjectLimitReachedError extends DomainError {
  readonly code = 'project_limit_reached';

  constructor(readonly limit: number) {
    super(`The account already has its ${String(limit)} projects: delete one to create another.`);
  }
}

export class SignUpClosedError extends DomainError {
  readonly code = 'sign_up_closed';

  constructor() {
    super('Sign-up is not open.');
  }
}

export class TermsOutdatedError extends DomainError {
  readonly code = 'terms_outdated';

  constructor(readonly currentVersion: string) {
    super(`The terms changed; read and accept version ${currentVersion}.`);
  }
}

export class SubscriptionExistsError extends DomainError {
  readonly code = 'subscription_exists';

  constructor() {
    super('The account already has a subscription; manage it in the billing portal.');
  }
}

export class NoBillingYetError extends DomainError {
  readonly code = 'no_billing_yet';

  constructor() {
    super('The account has not subscribed yet, so there is no billing to manage.');
  }
}

export class SubscriptionRequiredError extends DomainError {
  readonly code = 'subscription_required';

  constructor() {
    super('The account has no running subscription: subscribe to change its projects.');
  }
}

export class AccountEndedError extends DomainError {
  readonly code = 'account_ended';

  constructor() {
    super('The account has already ended; its data is deleted thirty days after the end.');
  }
}

export class ConfirmationMismatchError extends DomainError {
  readonly code = 'confirmation_mismatch';

  constructor() {
    super("The address typed is not the owner's: nothing was closed.");
  }
}
