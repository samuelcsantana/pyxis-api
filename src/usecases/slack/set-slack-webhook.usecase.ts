import { Inject, Injectable, Logger } from '@nestjs/common';
import { requireProFeature } from '../../domain/accounts/pro-features';
import {
  ACCOUNT_REPOSITORY,
  type AccountRepository,
} from '../../domain/repositories/account.repository';
import {
  PROJECT_SETTINGS_REPOSITORY,
  type ProjectSettingsRepository,
} from '../../domain/repositories/project-settings.repository';
import {
  SLACK_WEBHOOK_REPOSITORY,
  type SlackWebhookRepository,
} from '../../domain/repositories/slack-webhook.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';
import { SECRET_BOX, type SecretBox } from '../../domain/services/secret-box';
import {
  requireSlackWebhookUrl,
  slackWebhookContext,
  slackWebhookHint,
  type SlackWebhookStatus,
} from '../../domain/slack/slack-webhook';
import { changeableProject } from '../projects/owned-project';

export interface SetSlackWebhookCommand {
  readonly adminUserId: string;
  readonly projectId: string;
  readonly url: string;
}

@Injectable()
export class SetSlackWebhookUseCase {
  private readonly logger = new Logger(SetSlackWebhookUseCase.name);

  constructor(
    @Inject(PROJECT_SETTINGS_REPOSITORY) private readonly projects: ProjectSettingsRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(SLACK_WEBHOOK_REPOSITORY) private readonly webhooks: SlackWebhookRepository,
    @Inject(SECRET_BOX) private readonly box: SecretBox,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: SetSlackWebhookCommand): Promise<SlackWebhookStatus> {
    const url = requireSlackWebhookUrl(command.url);
    const { project, account } = await changeableProject(
      this.projects,
      this.accounts,
      command.projectId,
      command.adminUserId,
    );
    requireProFeature(account, 'slack_alerts');
    const status = await this.webhooks.save(
      project.id,
      { sealed: this.box.seal(url, slackWebhookContext(project.id)), hint: slackWebhookHint(url) },
      this.clock.now(),
    );
    this.logger.log({ message: 'slack_webhook.connected', projectId: project.id });
    return status;
  }
}
