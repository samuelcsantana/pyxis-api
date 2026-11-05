import { DomainError } from './domain.error';

export class InvalidSlackWebhookError extends DomainError {
  readonly code = 'invalid_slack_webhook';

  constructor() {
    super('Paste a Slack Incoming Webhook address: https://hooks.slack.com/services/...');
  }
}

export class SlackWebhookNotFoundError extends DomainError {
  readonly code = 'slack_webhook_not_found';

  constructor() {
    super('The project has no Slack webhook.');
  }
}

export class SlackUnavailableError extends DomainError {
  readonly code = 'slack_unavailable';

  constructor() {
    super('Slack alerts are not available right now.');
  }
}
