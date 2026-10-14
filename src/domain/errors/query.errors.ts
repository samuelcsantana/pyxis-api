import { DomainError } from './domain.error';

export class InvalidUsageMonthError extends DomainError {
  readonly code = 'invalid_usage_month';

  constructor() {
    super('Ask for a month as YYYY-MM, such as 2026-11.');
  }
}

export class InvalidRangeError extends DomainError {
  readonly code = 'invalid_range';

  constructor() {
    super(
      'Ask for real dates, from no later than to, at most 400 days, ending today at the latest.',
    );
  }
}
