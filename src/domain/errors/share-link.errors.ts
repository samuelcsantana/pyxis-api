import { DomainError } from './domain.error';

export class InvalidShareLinkError extends DomainError {
  readonly code = 'invalid_share_link';

  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message);
  }
}

export class ShareLinkNotFoundError extends DomainError {
  readonly code = 'share_link_not_found';

  constructor() {
    super('No open share link has this token or id.');
  }
}

export class ShareLinkLimitReachedError extends DomainError {
  readonly code = 'share_link_limit_reached';

  constructor(readonly limit: number) {
    super(`A project has at most ${String(limit)} share links: revoke one before adding another.`);
  }
}
