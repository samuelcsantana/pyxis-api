import { Logger } from '@nestjs/common';
import {
  type FreeAccountInactivity,
  inactivityDeletionDueAt,
  inactivityOf,
  storedAnEventSince,
} from '../../domain/accounts/free-account-inactivity';
import type {
  FreeAccountInactivityRepository,
  FreeAccountToSweep,
} from '../../domain/repositories/free-account-inactivity.repository';
import type { MailSender } from '../../domain/services/mail-sender';
import type { AccountDataDeletion } from './account-data-deletion';

export interface InactiveFreeAccountsSweep {
  readonly notified: number;
  readonly revived: number;
  readonly deleted: number;
  readonly partlyHeld: number;
  readonly peopleRemoved: number;
  readonly failed: readonly string[];
}

type InactivityNoticeKind = 'empty_free_account' | 'idle_free_account';

const NOTICE_OF: Readonly<Record<FreeAccountInactivity, InactivityNoticeKind>> = {
  empty: 'empty_free_account',
  idle: 'idle_free_account',
};

export class SweepInactiveFreeAccountsUseCase {
  private readonly logger = new Logger(SweepInactiveFreeAccountsUseCase.name);

  constructor(
    private readonly inactivity: FreeAccountInactivityRepository,
    private readonly deletion: AccountDataDeletion,
    private readonly mail: MailSender,
  ) {}

  async execute(now: Date): Promise<InactiveFreeAccountsSweep> {
    let notified = 0;
    let revived = 0;
    let deleted = 0;
    let partlyHeld = 0;
    let peopleRemoved = 0;
    const failed: string[] = [];
    for (const account of await this.inactivity.freeAccounts()) {
      const notifiedAt = account.inactivityNotifiedAt;
      if (notifiedAt === null) {
        notified += (await this.tryNotify(account, now)) ? 1 : 0;
        continue;
      }
      if (storedAnEventSince(account.lastEventAt, notifiedAt)) {
        await this.inactivity.clearNotice(account.accountId);
        this.logger.log({
          message: 'accounts.inactive_free_revived',
          accountId: account.accountId,
        });
        revived += 1;
        continue;
      }
      if (now < inactivityDeletionDueAt(notifiedAt)) {
        continue;
      }
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
      deleted += 1;
      await this.deletion.tryNotifyDeleted(account);
    }
    return { notified, revived, deleted, partlyHeld, peopleRemoved, failed };
  }

  private async tryNotify(account: FreeAccountToSweep, now: Date): Promise<boolean> {
    const inactivity = inactivityOf(account, now);
    if (inactivity === null) {
      return false;
    }
    const kind = NOTICE_OF[inactivity];
    try {
      await this.mail.sendAccountNotice(
        account.ownerEmail,
        { kind, deletionOn: inactivityDeletionDueAt(now) },
        account.ownerLanguage,
      );
      await this.inactivity.markNotified(account.accountId, now);
      this.logger.log({
        message: 'accounts.inactive_free_notified',
        accountId: account.accountId,
        inactivity,
      });
      return true;
    } catch (error) {
      this.logger.error({
        message: 'accounts.notice_failed',
        kind,
        accountId: account.accountId,
        reason: String(error),
      });
      return false;
    }
  }
}
