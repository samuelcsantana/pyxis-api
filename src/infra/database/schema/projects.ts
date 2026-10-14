import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { accounts } from './accounts';

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
    accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('projects_account_id_idx').on(table.accountId)],
);

export type ProjectRow = typeof projects.$inferSelect;
