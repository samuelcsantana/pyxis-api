import { date, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { adminUsers } from './admins';
import { projects } from './projects';

export const digestDeliveries = pgTable(
  'digest_deliveries',
  {
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    adminUserId: uuid('admin_user_id')
      .notNull()
      .references(() => adminUsers.id, { onDelete: 'cascade' }),
    weekStart: date('week_start', { mode: 'string' }).notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({
      name: 'digest_deliveries_pkey',
      columns: [table.projectId, table.adminUserId, table.weekStart],
    }),
  ],
);
