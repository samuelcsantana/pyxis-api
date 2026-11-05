import { sql } from 'drizzle-orm';
import { check, date, pgTable, primaryKey, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { ALERT_KINDS, type AlertKind } from '../../../domain/alerts/project-alert';
import { adminUsers } from './admins';
import { projects } from './projects';

const ALERT_KIND_LENGTH = 16;
const ALERT_KIND_VALUES = sql.raw(ALERT_KINDS.map((kind) => `'${kind}'`).join(', '));

export const alertDeliveries = pgTable(
  'alert_deliveries',
  {
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    adminUserId: uuid('admin_user_id')
      .notNull()
      .references(() => adminUsers.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { length: ALERT_KIND_LENGTH }).$type<AlertKind>().notNull(),
    day: date('day', { mode: 'string' }).notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({
      name: 'alert_deliveries_pkey',
      columns: [table.projectId, table.adminUserId, table.kind, table.day],
    }),
    check('alert_deliveries_kind_check', sql`${table.kind} in (${ALERT_KIND_VALUES})`),
  ],
);
