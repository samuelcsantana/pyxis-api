import { sql } from 'drizzle-orm';
import {
  char,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { ACCOUNT_STATUSES, type AccountStatus } from '../../../domain/accounts/account-status';
import { MAX_SUSPENSION_REASON_LENGTH } from '../../../domain/accounts/account-suspension';
import { MAX_TERMS_VERSION_LENGTH } from '../../../domain/accounts/sign-up-policy';
import type { BillingInterval } from '../../../domain/billing/billing-gateway';
import { adminUsers } from './admins';

const STATUS_LENGTH = 16;
const STRIPE_ID_LENGTH = 255;
const INTERVAL_LENGTH = 8;
const STATUS_VALUES = sql.raw(ACCOUNT_STATUSES.map((status) => `'${status}'`).join(', '));

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerAdminId: uuid('owner_admin_id')
      .notNull()
      .references(() => adminUsers.id, { onDelete: 'restrict' }),
    status: varchar('status', { length: STATUS_LENGTH }).$type<AccountStatus>().notNull(),
    ingestionPausedUntil: timestamp('ingestion_paused_until', { withTimezone: true }),
    stripeCustomerId: varchar('stripe_customer_id', { length: STRIPE_ID_LENGTH }).unique(),
    stripeSubscriptionId: varchar('stripe_subscription_id', { length: STRIPE_ID_LENGTH }).unique(),
    billingInterval: varchar('billing_interval', {
      length: INTERVAL_LENGTH,
    }).$type<BillingInterval>(),
    trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
    currentPeriodEndsAt: timestamp('current_period_ends_at', { withTimezone: true }),
    accessEndsAt: timestamp('access_ends_at', { withTimezone: true }),
    keysRevokedAt: timestamp('keys_revoked_at', { withTimezone: true }),
    endedNotifiedAt: timestamp('ended_notified_at', { withTimezone: true }),
    deletionRemindedAt: timestamp('deletion_reminded_at', { withTimezone: true }),
    welcomedAt: timestamp('welcomed_at', { withTimezone: true }),
    suspendedAt: timestamp('suspended_at', { withTimezone: true }),
    suspensionReason: varchar('suspension_reason', { length: MAX_SUSPENSION_REASON_LENGTH }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('accounts_owner_admin_id_idx').on(table.ownerAdminId),
    check('accounts_status_check', sql`${table.status} in (${STATUS_VALUES})`),
  ],
);

export type AccountRow = typeof accounts.$inferSelect;

const MONTH_LABEL_LENGTH = 7;

export const accountUsageMonths = pgTable(
  'account_usage_months',
  {
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    month: char('month', { length: MONTH_LABEL_LENGTH }).notNull(),
    events: integer('events').notNull(),
    notifiedLevel: smallint('notified_level').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ name: 'account_usage_months_pkey', columns: [table.accountId, table.month] }),
  ],
);

const EVENT_TYPE_LENGTH = 100;

export const billingEvents = pgTable('billing_events', {
  id: varchar('id', { length: STRIPE_ID_LENGTH }).primaryKey(),
  type: varchar('type', { length: EVENT_TYPE_LENGTH }).notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
});

export const trialCards = pgTable(
  'trial_cards',
  {
    fingerprint: varchar('fingerprint', { length: STRIPE_ID_LENGTH }).notNull(),
    accountId: uuid('account_id').notNull(),
    trialStartedAt: timestamp('trial_started_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ name: 'trial_cards_pkey', columns: [table.fingerprint, table.accountId] }),
    index('trial_cards_trial_started_at_idx').on(table.trialStartedAt),
  ],
);

export const termsAcceptances = pgTable(
  'terms_acceptances',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adminUserId: uuid('admin_user_id')
      .notNull()
      .references(() => adminUsers.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    version: varchar('version', { length: MAX_TERMS_VERSION_LENGTH }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('terms_acceptances_account_id_idx').on(table.accountId)],
);
