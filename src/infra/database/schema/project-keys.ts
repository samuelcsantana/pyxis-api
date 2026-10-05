import { sql } from 'drizzle-orm';
import {
  char,
  check,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { projects } from './projects';

export const projectKeys = pgTable(
  'project_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { length: 8 }).$type<'public' | 'secret'>().notNull(),
    publicKey: varchar('public_key', { length: 64 }),
    secretHash: char('secret_hash', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    index('project_keys_project_id_idx').on(table.projectId),
    uniqueIndex('project_keys_public_key_unique')
      .on(table.publicKey)
      .where(sql`${table.kind} = 'public'`),
    uniqueIndex('project_keys_secret_hash_unique')
      .on(table.secretHash)
      .where(sql`${table.kind} = 'secret'`),
    check(
      'project_keys_kind_matches_value',
      sql`(${table.kind} = 'public' AND ${table.publicKey} IS NOT NULL AND ${table.secretHash} IS NULL) OR (${table.kind} = 'secret' AND ${table.secretHash} IS NOT NULL AND ${table.publicKey} IS NULL)`,
    ),
  ],
);
