import { MAX_EVENTS_PER_BATCH } from '../events/event-limits';
import { DomainError } from './domain.error';

export class BatchTooLargeError extends DomainError {
  readonly code = 'batch_too_large';

  constructor() {
    super(`A batch holds at most ${String(MAX_EVENTS_PER_BATCH)} events.`);
  }
}

export class UnknownProjectKeyError extends DomainError {
  readonly code = 'unknown_key';

  constructor() {
    super('The project key is unknown or revoked.');
  }
}

export class OriginNotAllowedError extends DomainError {
  readonly code = 'origin_not_allowed';

  constructor() {
    super('This origin is not allowed to send events for the project.');
  }
}

export class ProjectRateLimitedError extends DomainError {
  readonly code = 'rate_limited';

  constructor(
    readonly retryAfterSeconds: number,
    readonly allowedOrigin: string,
  ) {
    super('The project sent too many batches; retry later.');
  }
}
