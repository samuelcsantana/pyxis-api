import { sql } from 'drizzle-orm';
import {
  boolean,
  char,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { MAX_ACCESS_TOKEN_NAME_LENGTH } from '../../../domain/auth/access-token-policy';
import { CODE_PURPOSES, type CodePurpose } from '../../../domain/auth/code-purpose';
import { DEFAULT_EMAIL_LANGUAGE, type EmailLanguage } from '../../../domain/auth/email-language';
import { WEEKLY_DIGEST_BY_DEFAULT } from '../../../domain/entities/email-preferences.entity';
import type {
  BrowserFamily,
  DeviceType,
  OsFamily,
} from '../../../domain/entities/tracked-event.entity';
import { projects } from './projects';

export const MAX_EMAIL_LENGTH = 254;
const PURPOSE_LENGTH = 16;
const PURPOSE_VALUES = sql.raw(CODE_PURPOSES.map((purpose) => `'${purpose}'`).join(', '));
const EMAIL_LANGUAGE_LENGTH = 8;

function emailLanguage() {
  return varchar('email_language', { length: EMAIL_LANGUAGE_LENGTH })
    .$type<EmailLanguage>()
    .notNull()
    .default(DEFAULT_EMAIL_LANGUAGE);
}

export const adminUsers = pgTable('admin_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: MAX_EMAIL_LENGTH }).notNull().unique(),
  emailLanguage: emailLanguage(),
  suspendedAt: timestamp('suspended_at', { withTimezone: true }),
  projectlessSince: timestamp('projectless_since', { withTimezone: true }),
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
    weeklyDigest: boolean('weekly_digest').notNull().default(WEEKLY_DIGEST_BY_DEFAULT),
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
    deviceType: varchar('device_type', { length: 16 }).$type<DeviceType>(),
    browser: varchar('browser', { length: 32 }).$type<BrowserFamily>(),
    os: varchar('os', { length: 32 }).$type<OsFamily>(),
  },
  (table) => [index('admin_sessions_admin_user_id_idx').on(table.adminUserId)],
);

export const adminAccessTokens = pgTable(
  'admin_access_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adminUserId: uuid('admin_user_id')
      .notNull()
      .references(() => adminUsers.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: MAX_ACCESS_TOKEN_NAME_LENGTH }).notNull(),
    tokenHash: char('token_hash', { length: 64 }).notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [index('admin_access_tokens_admin_user_id_idx').on(table.adminUserId)],
);

export const otpCodes = pgTable(
  'otp_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: MAX_EMAIL_LENGTH }).notNull(),
    codeHash: char('code_hash', { length: 64 }).notNull(),
    emailLanguage: emailLanguage(),
    purpose: varchar('purpose', { length: PURPOSE_LENGTH })
      .$type<CodePurpose>()
      .notNull()
      .default('sign_in'),
    attempts: integer('attempts').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
  },
  (table) => [
    index('otp_codes_email_created_at_idx').on(table.email, table.createdAt),
    check('otp_codes_purpose_check', sql`${table.purpose} in (${PURPOSE_VALUES})`),
  ],
);

export const reviewerCodes = pgTable('reviewer_codes', {
  adminUserId: uuid('admin_user_id')
    .primaryKey()
    .references(() => adminUsers.id, { onDelete: 'cascade' }),
  codeHash: char('code_hash', { length: 64 }).notNull(),
  failedAttempts: integer('failed_attempts').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});
