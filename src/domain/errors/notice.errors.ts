import { DomainError } from './domain.error';

export class InvalidNoticeError extends DomainError {
  readonly code = 'invalid_notice';

  constructor(
    readonly language: string,
    problem: string,
  ) {
    super(`The ${language} text of the notice ${problem}.`);
  }
}

export class NoticeCampaignExistsError extends DomainError {
  readonly code = 'notice_campaign_exists';

  constructor(readonly campaign: string) {
    super(`A notice named ${campaign} already exists: pick another campaign name.`);
  }
}
