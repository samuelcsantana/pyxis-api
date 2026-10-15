import { NoticeCampaignExistsError } from '../../domain/errors/notice.errors';
import {
  countByLanguage,
  ENDED_AUDIENCE,
  NOTICE_AUDIENCE,
  type NoticeAudienceCount,
  type NoticeContent,
} from '../../domain/notices/operator-notice';
import type { NoticeRepository } from '../../domain/repositories/notice.repository';
import type { Clock } from '../../domain/services/clock';

export interface CreateOperatorNoticeCommand {
  readonly campaign: string;
  readonly content: NoticeContent;
  readonly includeEnded: boolean;
  readonly dryRun: boolean;
}

export interface OperatorNoticeOutcome {
  readonly campaign: string;
  readonly created: boolean;
  readonly recipients: number;
  readonly byLanguage: NoticeAudienceCount;
}

export class CreateOperatorNoticeUseCase {
  constructor(
    private readonly notices: NoticeRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: CreateOperatorNoticeCommand): Promise<OperatorNoticeOutcome> {
    const audience = command.includeEnded ? ENDED_AUDIENCE : NOTICE_AUDIENCE;
    if (command.dryRun) {
      return this.outcome(command, false, await this.notices.audienceLanguages(audience));
    }
    const created = await this.notices.create({
      campaign: command.campaign,
      content: command.content,
      audience,
      createdAt: this.clock.now(),
    });
    if (created === null) {
      throw new NoticeCampaignExistsError(command.campaign);
    }
    return this.outcome(command, true, created.languages);
  }

  private outcome(
    command: CreateOperatorNoticeCommand,
    created: boolean,
    languages: Parameters<typeof countByLanguage>[0],
  ): OperatorNoticeOutcome {
    return {
      campaign: command.campaign,
      created,
      recipients: languages.length,
      byLanguage: countByLanguage(languages),
    };
  }
}
