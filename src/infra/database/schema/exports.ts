import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { EXPORT_STATUSES, type ExportStatus } from '../../../domain/exports/project-export';
import { adminUsers } from './admins';
import { projects } from './projects';

const STATUS_LENGTH = 16;
const OBJECT_KEY_LENGTH = 512;
const STATUS_VALUES = sql.raw(EXPORT_STATUSES.map((status) => `'${status}'`).join(', '));

export const projectExports = pgTable(
  'project_exports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    requestedBy: uuid('requested_by').references(() => adminUsers.id, { onDelete: 'set null' }),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull(),
    status: varchar('status', { length: STATUS_LENGTH }).$type<ExportStatus>().notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    objectKey: varchar('object_key', { length: OBJECT_KEY_LENGTH }),
    eventCount: integer('event_count'),
  },
  (table) => [
    index('project_exports_project_requested_at_idx').on(table.projectId, table.requestedAt),
    uniqueIndex('project_exports_one_pending_idx')
      .on(table.projectId)
      .where(sql`${table.status} = 'pending'`),
    check('project_exports_status_check', sql`${table.status} in (${STATUS_VALUES})`),
  ],
);
