import { Logger } from '@nestjs/common';
import {
  ACCOUNT_DELETION_BATCH_SIZE,
  deletionDueAt,
  deletionThreshold,
  staleIncompleteThresholds,
  reminderThreshold,
} from '../../domain/accounts/account-lifecycle';
import type { AccountNotice } from '../../domain/accounts/account-notice';
import { billingUpdateFor } from '../../domain/billing/account-billing';
import type { BillingGateway } from '../../domain/billing/billing-gateway';
import type { AccountBillingRepository } from '../../domain/repositories/account-billing.repository';
import type {
  AccountLifecycleRepository,
  EndedAccount,
} from '../../domain/repositories/account-lifecycle.repository';
import type { Clock } from '../../domain/services/clock';
import type { MailSender } from '../../domain/services/mail-sender';
import type { SweepProjectlessPeopleUseCase } from '../people/sweep-projectless-people.usecase';
import type { WelcomeAccountsUseCase } from './welcome-accounts.usecase';
import type { OpenFreePlacesUseCase } from './open-free-places.usecase';
import type { ConfirmSubscriptionsUseCase } from '../billing/confirm-subscriptions.usecase';

export interface AccountLifecycleReport {
  readonly freePlacesOpened: number;
  readonly welcomes: number;
  readonly subscriptionsConfirmed: number;
  readonly reconciled: number;
  readonly statusChanges: number;
  readonly reconcileFailures: number;
  readonly keysRevoked: number;
  readonly endedNotices: number;
  readonly reminders: number;
  readonly deleted: number;
  readonly partlyHeld: number;
  readonly incompleteRemoved: number;
  readonly peopleRemoved: number;
  readonly projectlessMarked: number;
  readonly projectlessRemoved: number;
}

export class AccountLifecycleFailedError extends Error {
  constructor(readonly failedAccounts: readonly string[]) {
    super(`The account lifecycle failed for ${String(failedAccounts.length)} account(s).`);
    this.name = 'AccountLifecycleFailedError';
  }
}

interface Removal {
  readonly removed: number;
  readonly peopleRemoved: number;
  readonly failed: readonly string[];
}

interface EndedAccountDeletion extends Removal {
  readonly partlyHeld: number;
}

type DeletionOutcome =
  | { readonly kind: 'deleted'; readonly peopleRemoved: number }
  | { readonly kind: 'partlyHeld'; readonly peopleRemoved: number }
  | { readonly kind: 'failed' };

export class RunAccountLifecycleUseCase {
  private readonly logger = new Logger(RunAccountLifecycleUseCase.name);

  constructor(
    private readonly lifecycle: AccountLifecycleRepository,
    private readonly billing: AccountBillingRepository,
    private readonly gateway: BillingGateway,
    private readonly mail: MailSender,
    private readonly clock: Clock,
    private readonly welcomes: WelcomeAccountsUseCase,
    private readonly projectless: SweepProjectlessPeopleUseCase,
    private readonly freePlaces: OpenFreePlacesUseCase,
    private readonly confirmations: ConfirmSubscriptionsUseCase,
  ) {}

  async execute(): Promise<AccountLifecycleReport> {
    const now = this.clock.now();
    const freePlacesOpened = await this.freePlaces.execute();
    const welcomes = await this.welcomes.welcomePending();
    const subscriptionsConfirmed = await this.confirmations.confirmPending();
    const reconciliation = await this.reconcile(now);
    const keysRevoked = await this.lifecycle.revokeKeysOfEndedAccounts(now);
    const endedNotices = await this.notifyEach(
      await this.lifecycle.endedToNotify(now),
      (account) => ({ kind: 'access_ended', deletionOn: deletionDueAt(account.accessEndsAt) }),
      (accountId) => this.lifecycle.markEndedNotified(accountId, now),
    );
    const reminders = await this.notifyEach(
      await this.lifecycle.dueForReminder(reminderThreshold(now), deletionThreshold(now)),
      (account) => ({ kind: 'deletion_reminder', deletionOn: deletionDueAt(account.accessEndsAt) }),
      (accountId) => this.lifecycle.markReminded(accountId, now),
    );
    const deletion = await this.deleteEnded(now);
    const incomplete = await this.removeStaleIncomplete(now);
    const sweep = await this.projectless.execute();
    const report: AccountLifecycleReport = {
      freePlacesOpened,
      welcomes,
      subscriptionsConfirmed,
      ...reconciliation,
      keysRevoked,
      endedNotices,
      reminders,
      deleted: deletion.removed,
      partlyHeld: deletion.partlyHeld,
      incompleteRemoved: incomplete.removed,
      peopleRemoved: deletion.peopleRemoved + incomplete.peopleRemoved,
      ...sweep,
    };
    this.logger.log({ message: 'accounts.lifecycle_done', ...report });
    const failed = [...deletion.failed, ...incomplete.failed];
    if (failed.length > 0) {
      throw new AccountLifecycleFailedError(failed);
    }
    return report;
  }

  private async reconcile(
    now: Date,
  ): Promise<Pick<AccountLifecycleReport, 'reconciled' | 'statusChanges' | 'reconcileFailures'>> {
    let reconciled = 0;
    let statusChanges = 0;
    let reconcileFailures = 0;
    for (const account of await this.lifecycle.reconcilable()) {
      try {
        const subscription = await this.gateway.subscription(account.subscriptionId);
        const update = billingUpdateFor(subscription, account, now);
        await this.billing.apply(account.accountId, update);
        reconciled += 1;
        if (update.status !== account.status) {
          statusChanges += 1;
          this.logger.warn({
            message: 'accounts.reconciled_status',
            accountId: account.accountId,
            from: account.status,
            to: update.status,
          });
        }
      } catch (error) {
        reconcileFailures += 1;
        this.logger.warn({
          message: 'accounts.reconcile_failed',
          accountId: account.accountId,
          reason: String(error),
        });
      }
    }
    return { reconciled, statusChanges, reconcileFailures };
  }

  private async notifyEach(
    accounts: readonly EndedAccount[],
    noticeFor: (account: EndedAccount) => AccountNotice,
    mark: (accountId: string) => Promise<void>,
  ): Promise<number> {
    let sent = 0;
    for (const account of accounts) {
      const notice = noticeFor(account);
      try {
        await this.mail.sendAccountNotice(account.ownerEmail, notice, account.ownerLanguage);
        await mark(account.accountId);
        sent += 1;
      } catch (error) {
        this.logger.error({
          message: 'accounts.notice_failed',
          kind: notice.kind,
          accountId: account.accountId,
          reason: String(error),
        });
      }
    }
    return sent;
  }

  private async deleteEnded(now: Date): Promise<EndedAccountDeletion> {
    let removed = 0;
    let partlyHeld = 0;
    let peopleRemoved = 0;
    const failed: string[] = [];
    for (const account of await this.lifecycle.dueForDeletion(deletionThreshold(now))) {
      const outcome = await this.deleteAccountData(account);
      if (outcome.kind === 'failed') {
        failed.push(account.accountId);
        continue;
      }
      peopleRemoved += outcome.peopleRemoved;
      if (outcome.kind === 'partlyHeld') {
        partlyHeld += 1;
        continue;
      }
      removed += 1;
      await this.tryNotifyDeleted(account);
    }
    return { removed, partlyHeld, peopleRemoved, failed };
  }

  private async deleteAccountData(account: EndedAccount): Promise<DeletionOutcome> {
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

  private async deleteEventsOf(projectId: string): Promise<void> {
    let deleted: number;
    do {
      deleted = await this.lifecycle.deleteEventsOf(projectId, ACCOUNT_DELETION_BATCH_SIZE);
    } while (deleted === ACCOUNT_DELETION_BATCH_SIZE);
  }

  private async tryNotifyDeleted(account: EndedAccount): Promise<void> {
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

  private async removeStaleIncomplete(now: Date): Promise<Removal> {
    let removed = 0;
    let peopleRemoved = 0;
    const failed: string[] = [];
    for (const account of await this.lifecycle.staleIncomplete(staleIncompleteThresholds(now))) {
      try {
        await this.lifecycle.deleteAccount(account.accountId);
        peopleRemoved += await this.lifecycle.deleteAdminsLeftWithout([account.ownerAdminId]);
        removed += 1;
      } catch (error) {
        failed.push(account.accountId);
        this.logger.error({
          message: 'accounts.incomplete_removal_failed',
          accountId: account.accountId,
          reason: String(error),
        });
      }
    }
    return { removed, peopleRemoved, failed };
  }
}
