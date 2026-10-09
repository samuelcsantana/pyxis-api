import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  adminProjectAccess,
  adminSessions,
  adminUsers,
  digestDeliveries,
  events,
  otpCodes,
  projectKeys,
  projects,
} from '.';

function foreignKeyTargets(
  table:
    | typeof events
    | typeof projectKeys
    | typeof adminProjectAccess
    | typeof adminSessions
    | typeof digestDeliveries,
): string[] {
  return getTableConfig(table).foreignKeys.map((foreignKey) => {
    const reference = foreignKey.reference();
    return `${getTableConfig(reference.foreignTable).name}.${reference.foreignColumns.map((column) => column.name).join(',')}`;
  });
}

describe('database schema', () => {
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
