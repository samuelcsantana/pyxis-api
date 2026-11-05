import { sql } from 'drizzle-orm';
import { boolean, index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { MAX_DELETION_HOLD_REASON_LENGTH } from '../../../domain/accounts/account-deletion-hold';
import { MAX_SUSPENSION_REASON_LENGTH } from '../../../domain/accounts/account-suspension';
import { DEFAULT_CURRENCY } from '../../../domain/projects/project-settings';
import { accounts } from './accounts';

const CURRENCY_CODE_LENGTH = 3;

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }).notNull(),
    allowedOrigins: text('allowed_origins')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    timezone: varchar('timezone', { length: 64 }).notNull().default('UTC'),
    conversionEvent: varchar('conversion_event', { length: 64 }),
    currency: varchar('currency', { length: CURRENCY_CODE_LENGTH })
      .notNull()
      .default(DEFAULT_CURRENCY),
    accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'restrict' }),
    ingestionSuspendedAt: timestamp('ingestion_suspended_at', { withTimezone: true }),
    ingestionSuspensionReason: varchar('ingestion_suspension_reason', {
      length: MAX_SUSPENSION_REASON_LENGTH,
    }),
    deletionHeldAt: timestamp('deletion_held_at', { withTimezone: true }),
    deletionHoldReason: varchar('deletion_hold_reason', {
      length: MAX_DELETION_HOLD_REASON_LENGTH,
    }),
    demoTraffic: boolean('demo_traffic').notNull().default(false),
    cityEnabled: boolean('city_enabled').notNull().default(false),
    visitorsEnabled: boolean('visitors_enabled').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('projects_account_id_idx').on(table.accountId)],
);

export type ProjectRow = typeof projects.$inferSelect;
