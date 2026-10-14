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
import { adminUsers } from './admins';

const STATUS_LENGTH = 16;
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
