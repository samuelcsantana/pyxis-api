import { Inject, Injectable, Logger } from '@nestjs/common';
import { SlackWebhookNotFoundError } from '../../domain/errors/slack.errors';
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
import { projectOwnedBy } from '../projects/owned-project';

export interface RemoveSlackWebhookCommand {
  readonly adminUserId: string;
  readonly projectId: string;
}

@Injectable()
export class RemoveSlackWebhookUseCase {
  private readonly logger = new Logger(RemoveSlackWebhookUseCase.name);

  constructor(
    @Inject(PROJECT_SETTINGS_REPOSITORY) private readonly projects: ProjectSettingsRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(SLACK_WEBHOOK_REPOSITORY) private readonly webhooks: SlackWebhookRepository,
  ) {}

  async execute(command: RemoveSlackWebhookCommand): Promise<void> {
    const { project } = await projectOwnedBy(
      this.projects,
      this.accounts,
      command.projectId,
      command.adminUserId,
    );
    if (!(await this.webhooks.remove(project.id))) {
      throw new SlackWebhookNotFoundError();
    }
    this.logger.log({ message: 'slack_webhook.removed', projectId: project.id });
  }
}
