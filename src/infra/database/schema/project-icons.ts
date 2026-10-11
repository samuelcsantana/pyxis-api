import { customType, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { projects } from './projects';

const bytea = customType<{ data: string; driverData: string }>({
  dataType: () => 'bytea',
});

export const projectIcons = pgTable('project_icons', {
  projectId: uuid('project_id')
    .primaryKey()
    .references(() => projects.id, { onDelete: 'cascade' }),
  contentType: varchar('content_type', { length: 32 }).notNull(),
  bytes: bytea('bytes').notNull(),
  version: varchar('version', { length: 16 }).notNull(),
  sourceUrl: text('source_url').notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
});
