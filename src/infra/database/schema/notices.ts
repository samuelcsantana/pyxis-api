import { jsonb, pgTable, primaryKey, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { MAX_CAMPAIGN_LENGTH, type NoticeContent } from '../../../domain/notices/operator-notice';
import { accounts } from './accounts';

export const notices = pgTable('notices', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaign: varchar('campaign', { length: MAX_CAMPAIGN_LENGTH }).notNull().unique(),
  content: jsonb('content').$type<NoticeContent>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});

export const noticeDeliveries = pgTable(
  'notice_deliveries',
  {
    noticeId: uuid('notice_id')
      .notNull()
      .references(() => notices.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
  },
  (table) => [
    primaryKey({ name: 'notice_deliveries_pkey', columns: [table.noticeId, table.accountId] }),
  ],
);
