import { DomainError } from './domain.error';

export class UnknownCursorError extends DomainError {
  readonly code = 'invalid_cursor';

  constructor() {
    super('The after cursor names no event of this project.');
  }
}
