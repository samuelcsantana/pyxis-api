import { Logger } from '@nestjs/common';
import { installReminderDue } from '../../domain/accounts/install-reminder';
import type {
  FreeAccountInactivityRepository,
  FreeAccountToSweep,
} from '../../domain/repositories/free-account-inactivity.repository';
import type { MailSender } from '../../domain/services/mail-sender';

export class RemindToInstallUseCase {
  private readonly logger = new Logger(RemindToInstallUseCase.name);

  constructor(
    private readonly inactivity: FreeAccountInactivityRepository,
    private readonly mail: MailSender,
  ) {}

  async execute(now: Date): Promise<number> {
    let reminded = 0;
    for (const account of await this.inactivity.freeAccounts()) {
      if (installReminderDue(account, now) && (await this.tryRemind(account, now))) {
        reminded += 1;
      }
    }
    return reminded;
  }

  private async tryRemind(account: FreeAccountToSweep, now: Date): Promise<boolean> {
    try {
      await this.mail.sendInstallReminder(
        account.ownerEmail,
        { project: account.oldestProjectWithoutEvents },
        account.ownerLanguage,
      );
      await this.inactivity.markInstallReminded(account.accountId, now);
      this.logger.log({ message: 'accounts.install_reminded', accountId: account.accountId });
      return true;
    } catch (error) {
      this.logger.error({
        message: 'accounts.install_reminder_failed',
        accountId: account.accountId,
        reason: String(error),
      });
      return false;
    }
  }
}
