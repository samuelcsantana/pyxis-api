import { Logger } from '@nestjs/common';
import { ACCOUNT_DELETION_BATCH_SIZE } from '../../domain/accounts/account-lifecycle';
import type {
  AccountLifecycleRepository,
  EndedAccount,
} from '../../domain/repositories/account-lifecycle.repository';
import type { MailSender } from '../../domain/services/mail-sender';

export type AccountToDelete = Pick<
  EndedAccount,
  'accountId' | 'ownerAdminId' | 'ownerEmail' | 'ownerLanguage'
>;

export type DeletionOutcome =
  | { readonly kind: 'deleted'; readonly peopleRemoved: number }
  | { readonly kind: 'partlyHeld'; readonly peopleRemoved: number }
  | { readonly kind: 'failed' };

export class AccountDataDeletion {
  private readonly logger = new Logger(AccountDataDeletion.name);

  constructor(
    private readonly lifecycle: AccountLifecycleRepository,
    private readonly mail: MailSender,
  ) {}

  async delete(account: AccountToDelete): Promise<DeletionOutcome> {
    try {
      const people = await this.lifecycle.peopleOf(account.accountId);
      const held = new Set(await this.lifecycle.heldProjectIdsOf(account.accountId));
      for (const projectId of await this.lifecycle.projectIdsOf(account.accountId)) {
        if (!held.has(projectId)) {
          await this.deleteEventsOf(projectId);
          await this.lifecycle.deleteProject(projectId);
        }
      }
      if (held.size > 0) {
        this.logger.log({
          message: 'accounts.deletion_partly_held',
          accountId: account.accountId,
          heldProjects: held.size,
        });
        return {
          kind: 'partlyHeld',
          peopleRemoved: await this.lifecycle.deleteAdminsLeftWithout(people),
        };
      }
      await this.lifecycle.deleteAccount(account.accountId);
      const peopleRemoved = await this.lifecycle.deleteAdminsLeftWithout([
        ...new Set([...people, account.ownerAdminId]),
      ]);
      this.logger.log({ message: 'accounts.deleted', accountId: account.accountId });
      return { kind: 'deleted', peopleRemoved };
    } catch (error) {
      this.logger.error({
        message: 'accounts.deletion_failed',
        accountId: account.accountId,
        reason: String(error),
      });
      return { kind: 'failed' };
    }
  }

  async tryNotifyDeleted(account: AccountToDelete): Promise<void> {
    try {
      await this.mail.sendAccountNotice(
        account.ownerEmail,
        { kind: 'account_deleted' },
        account.ownerLanguage,
      );
    } catch (error) {
      this.logger.error({
        message: 'accounts.notice_failed',
        kind: 'account_deleted',
        accountId: account.accountId,
        reason: String(error),
      });
    }
  }

  private async deleteEventsOf(projectId: string): Promise<void> {
    let deleted: number;
    do {
      deleted = await this.lifecycle.deleteEventsOf(projectId, ACCOUNT_DELETION_BATCH_SIZE);
    } while (deleted === ACCOUNT_DELETION_BATCH_SIZE);
  }
}
