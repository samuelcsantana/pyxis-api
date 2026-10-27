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

export class DeletionOnHoldError extends DomainError {
  readonly code = 'deletion_on_hold';

  constructor() {
    super("The account's data is held, so nothing of it can be deleted until the hold ends.");
  }
}

export class AccountSuspendedError extends DomainError {
  readonly code = 'account_suspended';

  constructor(readonly allowedOrigin: string | null = null) {
    super('The account is suspended: its owner was told why by e-mail and can contest it.');
  }
}

export class FreePlanClosedError extends DomainError {
  readonly code = 'free_plan_closed';

  constructor() {
    super('The free plan takes no account now: closing the account is the way to withdraw.');
  }
}

export class WithdrawalUnavailableError extends DomainError {
  readonly code = 'withdrawal_unavailable';

  constructor() {
    super('The account has no paid subscription to withdraw from.');
  }
}

export class WithdrawalWindowClosedError extends DomainError {
  readonly code = 'withdrawal_window_closed';

  constructor() {
    super('The 7 days to withdraw from the first payment of this subscription are over.');
  }
}
