import { char, index, integer, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { MAX_SHARE_LINK_NAME_LENGTH } from '../../../domain/share-links/share-link';
import { projects } from './projects';

const TOKEN_HASH_LENGTH = 64;
const PASSWORD_HASH_LENGTH = 256;

export const shareLinks = pgTable(
  'share_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: MAX_SHARE_LINK_NAME_LENGTH }).notNull(),
    tokenHash: char('token_hash', { length: TOKEN_HASH_LENGTH }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: PASSWORD_HASH_LENGTH }),
    failedUnlocks: integer('failed_unlocks').notNull().default(0),
    failedUnlocksSince: timestamp('failed_unlocks_since', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => [index('share_links_project_id_idx').on(table.projectId)],
);

export const shareLinkUnlocks = pgTable(
  'share_link_unlocks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shareLinkId: uuid('share_link_id')
      .notNull()
      .references(() => shareLinks.id, { onDelete: 'cascade' }),
    tokenHash: char('token_hash', { length: TOKEN_HASH_LENGTH }).notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('share_link_unlocks_share_link_id_idx').on(table.shareLinkId)],
);

export type ShareLinkRow = typeof shareLinks.$inferSelect;
