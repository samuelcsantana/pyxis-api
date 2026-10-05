import {
  boolean,
  char,
  index,
  jsonb,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import type { PropertyMap } from '../../../domain/entities/tracked-event.entity';
import { projects } from './projects';

export const events = pgTable(
  'events',
  {
    id: uuid('id').notNull(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
    name: varchar('name', { length: 64 }).notNull(),
    sessionId: uuid('session_id').notNull(),
    userId: varchar('user_id', { length: 64 }),
    path: varchar('path', { length: 256 }).notNull(),
    referrerHost: varchar('referrer_host', { length: 128 }),
    utmSource: varchar('utm_source', { length: 64 }),
    utmMedium: varchar('utm_medium', { length: 64 }),
    utmCampaign: varchar('utm_campaign', { length: 64 }),
    fromAdClick: boolean('from_ad_click').notNull().default(false),
    deviceType: varchar('device_type', { length: 16 }).notNull(),
    browser: varchar('browser', { length: 32 }).notNull(),
    os: varchar('os', { length: 32 }).notNull(),
    country: char('country', { length: 2 }),
    channel: varchar('channel', { length: 16 }),
    properties: jsonb('properties').$type<PropertyMap>().notNull().default({}),
  },
  (table) => [
    primaryKey({ name: 'events_pkey', columns: [table.projectId, table.id] }),
    index('events_project_occurred_at_idx').on(table.projectId, table.occurredAt),
    index('events_project_name_occurred_at_idx').on(table.projectId, table.name, table.occurredAt),
    index('events_project_user_occurred_at_idx').on(
      table.projectId,
      table.userId,
      table.occurredAt,
    ),
    index('events_project_session_occurred_at_idx').on(
      table.projectId,
      table.sessionId,
      table.occurredAt,
    ),
  ],
);

export type EventRow = typeof events.$inferSelect;
export type NewEventRow = typeof events.$inferInsert;
