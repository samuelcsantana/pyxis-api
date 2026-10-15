import { DomainError } from './domain.error';

export class ExportLimitReachedError extends DomainError {
  readonly code = 'export_limit_reached';

  constructor(perDay: number) {
    super(`The project already had ${String(perDay)} exports in the last day: try again later.`);
  }
}

export class ExportNotFoundError extends DomainError {
  readonly code = 'export_not_found';

  constructor() {
    super('This project has no export with this id.');
  }
}

export class ExportsUnavailableError extends DomainError {
  readonly code = 'exports_unavailable';

  constructor(reason: string) {
    super(`Exports are not available right now: ${reason}.`);
  }
}
