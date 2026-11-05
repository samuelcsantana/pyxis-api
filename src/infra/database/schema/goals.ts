import { sql } from 'drizzle-orm';
import {
  check,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { MAX_PATH_LENGTH } from '../../../domain/events/event-limits';
import { MAX_GOAL_NAME_LENGTH } from '../../../domain/goals/goal';
import { projects } from './projects';

const MAX_EVENT_NAME_LENGTH = 64;
const MAX_GOAL_KIND_LENGTH = 8;

export const goals = pgTable(
  'goals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: MAX_GOAL_NAME_LENGTH }).notNull(),
    kind: varchar('kind', { length: MAX_GOAL_KIND_LENGTH }).notNull(),
    eventName: varchar('event_name', { length: MAX_EVENT_NAME_LENGTH }),
    pathPattern: varchar('path_pattern', { length: MAX_PATH_LENGTH }),
    position: integer('position').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('goals_project_position_key').on(table.projectId, table.position),
    check(
      'goals_target_check',
      sql`(${table.kind} = 'event' AND ${table.eventName} IS NOT NULL AND ${table.pathPattern} IS NULL)
        OR (${table.kind} = 'page' AND ${table.pathPattern} IS NOT NULL AND ${table.eventName} IS NULL)`,
    ),
  ],
);

export type GoalRow = typeof goals.$inferSelect;
