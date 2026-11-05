import { DomainError } from './domain.error';

export class InvalidAnnotationError extends DomainError {
  readonly code = 'invalid_annotation';

  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message);
  }
}

export class AnnotationNotFoundError extends DomainError {
  readonly code = 'annotation_not_found';

  constructor() {
    super('The project has no annotation with this id.');
  }
}

export class AnnotationLimitReachedError extends DomainError {
  readonly code = 'annotation_limit_reached';

  constructor(readonly limit: number) {
    super(`A project has at most ${String(limit)} annotations: delete one before adding another.`);
  }
}
