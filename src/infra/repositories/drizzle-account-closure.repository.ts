import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { AccountClosureRepository } from '../../domain/repositories/account-closure.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { accounts } from '../database/schema/accounts';
import { projectKeys } from '../database/schema/project-keys';
import { projects } from '../database/schema/projects';

@Injectable()
export class DrizzleAccountClosureRepository implements AccountClosureRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async subscriptionOf(accountId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ subscriptionId: accounts.stripeSubscriptionId })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);
    return row?.subscriptionId ?? null;
  }

  close(accountId: string, at: Date): Promise<void> {
    return this.db.transaction(async (transaction) => {
      await transaction
        .update(accounts)
        .set({
          status: 'ended',
          accessEndsAt: at,
          keysRevokedAt: at,
          backToFreeNoticeDueAt: null,
          freePlanFitDueAt: null,
        })
        .where(eq(accounts.id, accountId));
      await transaction
        .update(projectKeys)
        .set({ revokedAt: at })
        .where(
          and(
            isNull(projectKeys.revokedAt),
            inArray(
              projectKeys.projectId,
              transaction
                .select({ id: projects.id })
                .from(projects)
                .where(eq(projects.accountId, accountId)),
            ),
          ),
        );
    });
  }

  async markEndedNotified(accountId: string, at: Date): Promise<void> {
    await this.db.update(accounts).set({ endedNotifiedAt: at }).where(eq(accounts.id, accountId));
  }
}
