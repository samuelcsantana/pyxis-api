import { DomainError } from './domain.error';

export class InvalidRangeError extends DomainError {
  readonly code = 'invalid_range';

  constructor() {
    super(
      'Ask for real dates, from no later than to, at most 400 days, ending today at the latest.',
    );
  }
}
