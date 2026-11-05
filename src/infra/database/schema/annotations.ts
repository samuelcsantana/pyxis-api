import { date, index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { MAX_ANNOTATION_LENGTH } from '../../../domain/annotations/annotation';
import { projects } from './projects';

export const annotations = pgTable(
  'annotations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    day: date('day', { mode: 'string' }).notNull(),
    text: varchar('text', { length: MAX_ANNOTATION_LENGTH }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('annotations_project_id_day_idx').on(table.projectId, table.day)],
);
