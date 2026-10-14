import { sql } from 'drizzle-orm';
import { check, index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
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
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('accounts_owner_admin_id_idx').on(table.ownerAdminId),
    check('accounts_status_check', sql`${table.status} in (${STATUS_VALUES})`),
  ],
);

export type AccountRow = typeof accounts.$inferSelect;
