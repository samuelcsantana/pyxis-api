import {
  char,
  index,
  integer,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { projects } from './projects';

export const MAX_EMAIL_LENGTH = 254;

export const adminUsers = pgTable('admin_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: MAX_EMAIL_LENGTH }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const adminProjectAccess = pgTable(
  'admin_project_access',
  {
    adminUserId: uuid('admin_user_id')
      .notNull()
      .references(() => adminUsers.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      name: 'admin_project_access_pkey',
      columns: [table.adminUserId, table.projectId],
    }),
  ],
);

export const adminSessions = pgTable(
  'admin_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adminUserId: uuid('admin_user_id')
      .notNull()
      .references(() => adminUsers.id, { onDelete: 'cascade' }),
    tokenHash: char('token_hash', { length: 64 }).notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [index('admin_sessions_admin_user_id_idx').on(table.adminUserId)],
);

export const otpCodes = pgTable(
  'otp_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: MAX_EMAIL_LENGTH }).notNull(),
    codeHash: char('code_hash', { length: 64 }).notNull(),
    attempts: integer('attempts').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
  },
  (table) => [index('otp_codes_email_created_at_idx').on(table.email, table.createdAt)],
);
