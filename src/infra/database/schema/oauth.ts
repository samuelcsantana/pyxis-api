import { sql } from 'drizzle-orm';
import { char, check, index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import {
  CONNECTION_TOKEN_KINDS,
  type ConnectionTokenKind,
  MAX_CLIENT_ID_LENGTH,
  MAX_REDIRECT_URI_LENGTH,
  MAX_STATE_LENGTH,
} from '../../../domain/oauth/oauth-policy';
import { adminUsers } from './admins';

const HASH_LENGTH = 64;
const CODE_CHALLENGE_LENGTH = 43;
const DECISION_LENGTH = 16;
const TOKEN_KIND_LENGTH = 16;

export const AUTHORIZATION_DECISIONS = ['approved', 'denied'] as const;
export type AuthorizationDecision = (typeof AUTHORIZATION_DECISIONS)[number];

const DECISION_VALUES = sql.raw(AUTHORIZATION_DECISIONS.map((value) => `'${value}'`).join(', '));
const TOKEN_KIND_VALUES = sql.raw(CONNECTION_TOKEN_KINDS.map((kind) => `'${kind}'`).join(', '));

function at(name: string) {
  return timestamp(name, { withTimezone: true });
}

export const oauthConnections = pgTable(
  'oauth_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adminUserId: uuid('admin_user_id')
      .notNull()
      .references(() => adminUsers.id, { onDelete: 'cascade' }),
    clientId: varchar('client_id', { length: MAX_CLIENT_ID_LENGTH }).notNull(),
    createdAt: at('created_at').notNull(),
    lastUsedAt: at('last_used_at').notNull(),
    revokedAt: at('revoked_at'),
  },
  (table) => [index('oauth_connections_admin_user_id_idx').on(table.adminUserId)],
);

export const oauthAuthorizationRequests = pgTable(
  'oauth_authorization_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: varchar('client_id', { length: MAX_CLIENT_ID_LENGTH }).notNull(),
    redirectUri: varchar('redirect_uri', { length: MAX_REDIRECT_URI_LENGTH }).notNull(),
    state: varchar('state', { length: MAX_STATE_LENGTH }),
    codeChallenge: char('code_challenge', { length: CODE_CHALLENGE_LENGTH }).notNull(),
    createdAt: at('created_at').notNull(),
    expiresAt: at('expires_at').notNull(),
    decision: varchar('decision', { length: DECISION_LENGTH }).$type<AuthorizationDecision>(),
    decidedAt: at('decided_at'),
    adminUserId: uuid('admin_user_id').references(() => adminUsers.id, { onDelete: 'cascade' }),
    codeHash: char('code_hash', { length: HASH_LENGTH }).unique(),
    codeExpiresAt: at('code_expires_at'),
    codeUsedAt: at('code_used_at'),
    connectionId: uuid('connection_id').references(() => oauthConnections.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    check(
      'oauth_authorization_requests_decision_check',
      sql`${table.decision} in (${DECISION_VALUES})`,
    ),
  ],
);

export const oauthConnectionTokens = pgTable(
  'oauth_connection_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => oauthConnections.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { length: TOKEN_KIND_LENGTH }).$type<ConnectionTokenKind>().notNull(),
    tokenHash: char('token_hash', { length: HASH_LENGTH }).notNull().unique(),
    createdAt: at('created_at').notNull(),
    expiresAt: at('expires_at').notNull(),
    rotatedAt: at('rotated_at'),
  },
  (table) => [
    index('oauth_connection_tokens_connection_id_idx').on(table.connectionId),
    check('oauth_connection_tokens_kind_check', sql`${table.kind} in (${TOKEN_KIND_VALUES})`),
  ],
);
