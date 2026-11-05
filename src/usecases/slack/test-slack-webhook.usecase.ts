import { Inject, Injectable, Logger } from '@nestjs/common';
import { requireProFeature } from '../../domain/accounts/pro-features';
import type { EmailLanguage } from '../../domain/auth/email-language';
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
import { CLOCK, type Clock } from '../../domain/services/clock';
import { SECRET_BOX, type SecretBox } from '../../domain/services/secret-box';
import { SLACK_SENDER, type SlackSender } from '../../domain/slack/slack-sender';
import { brokenReasonOf, slackWebhookContext } from '../../domain/slack/slack-webhook';
import { changeableProject } from '../projects/owned-project';

export interface TestSlackWebhookCommand {
  readonly adminUserId: string;
  readonly projectId: string;
  readonly language: EmailLanguage;
}

export type SlackTestOutcome = 'sent' | 'broken' | 'failed';

@Injectable()
export class TestSlackWebhookUseCase {
  private readonly logger = new Logger(TestSlackWebhookUseCase.name);

  constructor(
    @Inject(PROJECT_SETTINGS_REPOSITORY) private readonly projects: ProjectSettingsRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(SLACK_WEBHOOK_REPOSITORY) private readonly webhooks: SlackWebhookRepository,
    @Inject(SECRET_BOX) private readonly box: SecretBox,
    @Inject(SLACK_SENDER) private readonly slack: SlackSender,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: TestSlackWebhookCommand): Promise<SlackTestOutcome> {
    const { project, account } = await changeableProject(
      this.projects,
      this.accounts,
      command.projectId,
      command.adminUserId,
    );
    requireProFeature(account, 'slack_alerts');
    const sealed = await this.webhooks.sealedOf(project.id);
    if (sealed === null) {
      throw new SlackWebhookNotFoundError();
    }
    const url = this.box.open(sealed, slackWebhookContext(project.id));
    const delivery = await this.slack.postTest(url, project.name, command.language);
    switch (delivery.outcome) {
      case 'sent':
        this.logger.log({ message: 'slack_webhook.tested', projectId: project.id });
        return 'sent';
      case 'gone':
        await this.webhooks.markBroken(
          project.id,
          brokenReasonOf(delivery.reason),
          this.clock.now(),
        );
        this.logger.warn({ message: 'slack_webhook.broken', projectId: project.id });
        return 'broken';
      case 'failed':
        this.logger.warn({
          message: 'slack_webhook.test_failed',
          projectId: project.id,
          status: delivery.status,
        });
        return 'failed';
    }
  }
}
