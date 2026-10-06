export class InvalidBatchError extends Error {
  readonly code = 'invalid_batch';

  constructor() {
    super('The batch does not match the contract.');
    this.name = 'InvalidBatchError';
  }
}

export class ClientRateLimitedError extends Error {
  readonly code = 'rate_limited';

  constructor(readonly retryAfterSeconds: number) {
    super('Too many batches from this address; retry later.');
    this.name = 'ClientRateLimitedError';
  }
}

export class InvalidRequestError extends Error {
  readonly code = 'invalid_request';

  constructor() {
    super('The request body does not match the contract.');
    this.name = 'InvalidRequestError';
  }
}

export class DashboardOriginRequiredError extends Error {
  readonly code = 'origin_not_allowed';

  constructor() {
    super('This request must come from the dashboard.');
    this.name = 'DashboardOriginRequiredError';
  }
}
