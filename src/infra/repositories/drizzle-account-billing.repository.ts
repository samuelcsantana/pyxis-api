import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, or, type SQL } from 'drizzle-orm';
import type {
  AccountBillingState,
  AccountBillingUpdate,
} from '../../domain/billing/account-billing';
import { isUuid } from '../../domain/events/text-shapes';
import type {
  AccountBillingRepository,
  BillingOwnerLookup,
} from '../../domain/repositories/account-billing.repository';
import type {
  BillingEventRepository,
  ReceivedBillingEvent,
} from '../../domain/repositories/billing-event.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { accounts, accountUsageMonths, billingEvents } from '../database/schema/accounts';

const END_OF_ACCESS_CLEARED = {
  keysRevokedAt: null,
  endedNotifiedAt: null,
  deletionRemindedAt: null,
} as const;

function ownerConditions(lookup: BillingOwnerLookup): SQL[] {
  return [
    ...(lookup.accountId !== null && isUuid(lookup.accountId)
      ? [eq(accounts.id, lookup.accountId)]
      : []),
    ...(lookup.subscriptionId === null
      ? []
      : [eq(accounts.stripeSubscriptionId, lookup.subscriptionId)]),
    ...(lookup.customerId === null ? [] : [eq(accounts.stripeCustomerId, lookup.customerId)]),
  ];
}

@Injectable()
export class DrizzleAccountBillingRepository implements AccountBillingRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async find(lookup: BillingOwnerLookup): Promise<AccountBillingState | null> {
    const [first, ...rest] = ownerConditions(lookup);
    if (first === undefined) {
      return null;
    }
    const [row] = await this.db
      .select({
        accountId: accounts.id,
        status: accounts.status,
        accessEndsAt: accounts.accessEndsAt,
      })
      .from(accounts)
      .where(or(first, ...rest))
      .limit(1);
    return row ?? null;
  }

  apply(accountId: string, update: AccountBillingUpdate): Promise<void> {
    const { restoresAccess, leavesFreePlan, ...columns } = update;
    return this.db.transaction(async (transaction) => {
      await transaction
        .update(accounts)
        .set({
          ...columns,
          ...(restoresAccess ? END_OF_ACCESS_CLEARED : {}),
          ...(leavesFreePlan === null
            ? {}
            : { ingestionPausedUntil: null, subscriptionConfirmationDueAt: leavesFreePlan.at }),
        })
        .where(eq(accounts.id, accountId));
      if (leavesFreePlan !== null) {
        await transaction
          .update(accountUsageMonths)
          .set({ notifiedLevel: 0 })
          .where(
            and(
              eq(accountUsageMonths.accountId, accountId),
              eq(accountUsageMonths.month, leavesFreePlan.month),
            ),
          );
      }
    });
  }
}

@Injectable()
export class DrizzleBillingEventRepository implements BillingEventRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async claim(event: ReceivedBillingEvent, at: Date): Promise<boolean> {
    await this.db
      .insert(billingEvents)
      .values({ id: event.id, type: event.type, receivedAt: at })
      .onConflictDoNothing();
    const [row] = await this.db
      .select({ id: billingEvents.id })
      .from(billingEvents)
      .where(and(eq(billingEvents.id, event.id), isNull(billingEvents.processedAt)));
    return row !== undefined;
  }

  async complete(eventId: string, at: Date): Promise<void> {
    await this.db
      .update(billingEvents)
      .set({ processedAt: at })
      .where(eq(billingEvents.id, eventId));
  }
}
