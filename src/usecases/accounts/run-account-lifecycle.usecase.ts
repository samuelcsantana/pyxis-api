import { Logger } from '@nestjs/common';
import {
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
import type { FallBackToFreePlanUseCase } from '../billing/fall-back-to-free-plan.usecase';
import { AccountDataDeletion } from './account-data-deletion';
import type { SweepInactiveFreeAccountsUseCase } from './sweep-inactive-free-accounts.usecase';

export interface AccountLifecycleReport {
  readonly freePlacesOpened: number;
  readonly welcomes: number;
  readonly subscriptionsConfirmed: number;
  readonly backToFreeNotices: number;
  readonly reconciled: number;
  readonly statusChanges: number;
  readonly reconcileFailures: number;
  readonly unfitFreeAccountsEnded: number;
  readonly keysRevoked: number;
  readonly endedNotices: number;
  readonly reminders: number;
  readonly deleted: number;
  readonly partlyHeld: number;
  readonly incompleteRemoved: number;
  readonly inactiveFreeNotices: number;
  readonly inactiveFreeRevived: number;
  readonly inactiveFreeDeleted: number;
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

export class RunAccountLifecycleUseCase {
  private readonly logger = new Logger(RunAccountLifecycleUseCase.name);
  private readonly deletion: AccountDataDeletion;

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
    private readonly fallbacks: FallBackToFreePlanUseCase,
    private readonly inactiveFreeAccounts: SweepInactiveFreeAccountsUseCase,
  ) {
    this.deletion = new AccountDataDeletion(lifecycle, mail);
  }

  async execute(): Promise<AccountLifecycleReport> {
    const now = this.clock.now();
    const freePlacesOpened = await this.freePlaces.execute(now);
    const welcomes = await this.welcomes.welcomePending();
    const subscriptionsConfirmed = await this.confirmations.confirmPending();
    const backToFreeNotices = await this.fallbacks.notifyPending();
    const reconciliation = await this.reconcile(now);
    const unfitFreeAccountsEnded = await this.fallbacks.settleFitDeadlines(now);
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
    const inactive = await this.inactiveFreeAccounts.execute(now);
    const sweep = await this.projectless.execute();
    const report: AccountLifecycleReport = {
      freePlacesOpened,
      welcomes,
      subscriptionsConfirmed,
      backToFreeNotices,
      ...reconciliation,
      unfitFreeAccountsEnded,
      keysRevoked,
      endedNotices,
      reminders,
      deleted: deletion.removed,
      partlyHeld: deletion.partlyHeld + inactive.partlyHeld,
      incompleteRemoved: incomplete.removed,
      inactiveFreeNotices: inactive.notified,
      inactiveFreeRevived: inactive.revived,
      inactiveFreeDeleted: inactive.deleted,
      peopleRemoved: deletion.peopleRemoved + incomplete.peopleRemoved + inactive.peopleRemoved,
      ...sweep,
    };
    this.logger.log({ message: 'accounts.lifecycle_done', ...report });
    const failed = [...deletion.failed, ...incomplete.failed, ...inactive.failed];
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
        const fellBack = await this.fallbacks.tryFallBack(account, update);
        if (!fellBack) {
          await this.billing.apply(account.accountId, update);
        }
        const status = fellBack ? 'free' : update.status;
        reconciled += 1;
        if (status !== account.status) {
          statusChanges += 1;
          this.logger.warn({
            message: 'accounts.reconciled_status',
            accountId: account.accountId,
            from: account.status,
            to: status,
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
      const outcome = await this.deletion.delete(account);
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
      await this.deletion.tryNotifyDeleted(account);
    }
    return { removed, partlyHeld, peopleRemoved, failed };
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
