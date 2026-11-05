import { Inject, Injectable } from '@nestjs/common';
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
import type { SlackWebhookStatus } from '../../domain/slack/slack-webhook';
import { projectOwnedBy } from '../projects/owned-project';

export interface GetSlackWebhookCommand {
  readonly adminUserId: string;
  readonly projectId: string;
}

@Injectable()
export class GetSlackWebhookUseCase {
  constructor(
    @Inject(PROJECT_SETTINGS_REPOSITORY) private readonly projects: ProjectSettingsRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(SLACK_WEBHOOK_REPOSITORY) private readonly webhooks: SlackWebhookRepository,
  ) {}

  async execute(command: GetSlackWebhookCommand): Promise<SlackWebhookStatus | null> {
    const { project } = await projectOwnedBy(
      this.projects,
      this.accounts,
      command.projectId,
      command.adminUserId,
    );
    return this.webhooks.statusOf(project.id);
  }
}
