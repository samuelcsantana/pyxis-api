import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  accountUsageMonths,
  accounts,
  adminAccessTokens,
  adminProjectAccess,
  adminSessions,
  adminUsers,
  digestDeliveries,
  events,
  otpCodes,
  projectIcons,
  projectKeys,
  projects,
  termsAcceptances,
} from '.';

function foreignKeyTargets(
  table:
    | typeof accountUsageMonths
    | typeof accounts
    | typeof projects
    | typeof events
    | typeof projectKeys
    | typeof adminProjectAccess
    | typeof adminSessions
    | typeof adminAccessTokens
    | typeof digestDeliveries
    | typeof projectIcons
    | typeof termsAcceptances,
): string[] {
  return getTableConfig(table).foreignKeys.map((foreignKey) => {
    const reference = foreignKey.reference();
    return `${getTableConfig(reference.foreignTable).name}.${reference.foreignColumns.map((column) => column.name).join(',')}`;
  });
}

describe('database schema', () => {
  it('keeps one icon per project, as bytes, gone with its project', () => {
    const config = getTableConfig(projectIcons);
    const bytes = config.columns.find((column) => column.name === 'bytes');

    expect(config.columns.find((column) => column.primary)?.name).toBe('project_id');
    expect(bytes?.getSQLType()).toBe('bytea');
    expect(bytes?.notNull).toBe(true);
    expect(foreignKeyTargets(projectIcons)).toEqual(['projects.id']);
    expect(config.foreignKeys[0]?.onDelete).toBe('cascade');
  });

  it('keys events by project and event id, which makes a resent event a no-op', () => {
    const [primaryKey] = getTableConfig(events).primaryKeys;

    expect(primaryKey?.getName()).toBe('events_pkey');
    expect(primaryKey?.columns.map((column) => column.name)).toEqual(['project_id', 'id']);
  });

  it('indexes events for the dashboard queries, always starting with the project', () => {
    expect(
      getTableConfig(events).indexes.map((index) => ({
        name: index.config.name,
        columns: index.config.columns.map((column) => ('name' in column ? column.name : '')),
      })),
    ).toEqual([
      { name: 'events_project_occurred_at_idx', columns: ['project_id', 'occurred_at'] },
      {
        name: 'events_project_name_occurred_at_idx',
        columns: ['project_id', 'name', 'occurred_at'],
      },
      {
        name: 'events_project_user_occurred_at_idx',
        columns: ['project_id', 'user_id', 'occurred_at'],
      },
      {
        name: 'events_project_session_occurred_at_idx',
        columns: ['project_id', 'session_id', 'occurred_at'],
      },
    ]);
  });

  it('ties events and keys to their project and deletes them with it', () => {
    expect(foreignKeyTargets(events)).toEqual(['projects.id']);
    expect(foreignKeyTargets(projectKeys)).toEqual(['projects.id']);
    expect(getTableConfig(events).foreignKeys[0]?.onDelete).toBe('cascade');
  });

  it('lets a key row hold either a public key or a secret hash, never both', () => {
    const config = getTableConfig(projectKeys);

    expect(config.checks.map((check) => check.name)).toEqual(['project_keys_kind_matches_value']);
    expect(config.indexes.map((index) => [index.config.name, index.config.unique])).toEqual([
      ['project_keys_project_id_idx', false],
      ['project_keys_public_key_unique', true],
      ['project_keys_secret_hash_unique', true],
    ]);
  });

  it('gives projects a UTC default time zone and no conversion event', () => {
    const columns = Object.fromEntries(
      getTableConfig(projects).columns.map((column) => [column.name, column]),
    );

    expect(columns.timezone?.default).toBe('UTC');
    expect(columns.conversion_event?.notNull).toBe(false);
  });

  it('gives a project an optional account, which cannot go while it still has projects', () => {
    const config = getTableConfig(projects);
    const accountId = config.columns.find((column) => column.name === 'account_id');

    expect(accountId?.notNull).toBe(false);
    expect(foreignKeyTargets(projects)).toEqual(['accounts.id']);
    expect(config.foreignKeys[0]?.onDelete).toBe('restrict');
    expect(config.indexes.map((index) => index.config.name)).toEqual(['projects_account_id_idx']);
  });

  it('ties an account to the admin who owns it, kept while the account exists', () => {
    const config = getTableConfig(accounts);

    expect(foreignKeyTargets(accounts)).toEqual(['admin_users.id']);
    expect(config.foreignKeys[0]?.onDelete).toBe('restrict');
    expect(config.indexes.map((index) => index.config.name)).toEqual([
      'accounts_owner_admin_id_idx',
    ]);
    expect(config.checks.map((check) => check.name)).toEqual(['accounts_status_check']);
  });

  it('keeps one usage figure per account and month, gone with the account', () => {
    const config = getTableConfig(accountUsageMonths);

    expect(config.primaryKeys[0]?.columns.map((column) => column.name)).toEqual([
      'account_id',
      'month',
    ]);
    expect(foreignKeyTargets(accountUsageMonths)).toEqual(['accounts.id']);
    expect(config.foreignKeys[0]?.onDelete).toBe('cascade');
  });

  it('keeps each acceptance of the terms, deleted with its admin or its account', () => {
    const config = getTableConfig(termsAcceptances);

    expect(foreignKeyTargets(termsAcceptances)).toEqual(['admin_users.id', 'accounts.id']);
    expect(config.foreignKeys.map((foreignKey) => foreignKey.onDelete)).toEqual([
      'cascade',
      'cascade',
    ]);
    expect(config.indexes.map((index) => index.config.name)).toEqual([
      'terms_acceptances_account_id_idx',
    ]);
  });

  it('allows only the known purposes of an e-mailed code', () => {
    expect(getTableConfig(otpCodes).checks.map((check) => check.name)).toEqual([
      'otp_codes_purpose_check',
    ]);
  });

  it('keys project access by admin and project, both deleted with their owner', () => {
    const config = getTableConfig(adminProjectAccess);

    expect(config.primaryKeys[0]?.columns.map((column) => column.name)).toEqual([
      'admin_user_id',
      'project_id',
    ]);
    expect(foreignKeyTargets(adminProjectAccess)).toEqual(['admin_users.id', 'projects.id']);
  });

  it('remembers one digest per project, admin and week, deleted with either', () => {
    const config = getTableConfig(digestDeliveries);

    expect(config.primaryKeys[0]?.getName()).toBe('digest_deliveries_pkey');
    expect(config.primaryKeys[0]?.columns.map((column) => column.name)).toEqual([
      'project_id',
      'admin_user_id',
      'week_start',
    ]);
    expect(foreignKeyTargets(digestDeliveries)).toEqual(['projects.id', 'admin_users.id']);
  });

  it('ties sessions to their admin and indexes them by admin', () => {
    expect(foreignKeyTargets(adminSessions)).toEqual(['admin_users.id']);
    expect(getTableConfig(adminSessions).indexes.map((index) => index.config.name)).toEqual([
      'admin_sessions_admin_user_id_idx',
    ]);
  });

  it('ties access tokens to their admin, keeps each hash once and indexes them by admin', () => {
    const config = getTableConfig(adminAccessTokens);

    expect(foreignKeyTargets(adminAccessTokens)).toEqual(['admin_users.id']);
    expect(config.indexes.map((index) => index.config.name)).toEqual([
      'admin_access_tokens_admin_user_id_idx',
    ]);
    expect(config.columns.find((column) => column.name === 'token_hash')?.isUnique).toBe(true);
  });

  it('finds the codes of an email by creation time', () => {
    expect(
      getTableConfig(otpCodes).indexes.map((index) => [
        index.config.name,
        index.config.columns.map((column) => ('name' in column ? column.name : '')),
      ]),
    ).toEqual([['otp_codes_email_created_at_idx', ['email', 'created_at']]]);
  });

  it('keeps one admin per email', () => {
    const email = getTableConfig(adminUsers).columns.find((column) => column.name === 'email');

    expect(email?.isUnique).toBe(true);
  });
});
