import { appRoleGrantStatements } from './app-role-grants';
import {
  applyMigrations,
  type MigrationTarget,
  migrationConnectionString,
  MISSING_MIGRATION_URL_MESSAGE,
} from './migrations';

interface FakeTarget extends MigrationTarget {
  readonly calls: string[];
}

function fakeTarget(options: { roleExists?: boolean; failMigrations?: boolean } = {}): FakeTarget {
  const calls: string[] = [];
  return {
    calls,
    runMigrations: () => {
      calls.push('migrate');
      return options.failMigrations === true
        ? Promise.reject(new Error('migration failed'))
        : Promise.resolve();
    },
    roleExists: (role) => {
      calls.push(`roleExists ${role}`);
      return Promise.resolve(options.roleExists ?? true);
    },
    execute: (statement) => {
      calls.push(statement);
      return Promise.resolve();
    },
    close: () => {
      calls.push('close');
      return Promise.resolve();
    },
  };
}

describe('applyMigrations', () => {
  it('migrates and grants nothing when no application role is configured', async () => {
    const target = fakeTarget();

    await expect(applyMigrations(target, undefined)).resolves.toEqual({ grantedTo: null });
    expect(target.calls).toEqual(['migrate', 'close']);
  });

  it('migrates, then grants the application role its row access', async () => {
    const target = fakeTarget();

    await expect(applyMigrations(target, 'pyxis_app')).resolves.toEqual({
      grantedTo: 'pyxis_app',
    });
    expect(target.calls).toEqual([
      'migrate',
      'roleExists pyxis_app',
      ...appRoleGrantStatements('pyxis_app'),
      'close',
    ]);
  });

  it('fails without granting when the application role does not exist', async () => {
    const target = fakeTarget({ roleExists: false });

    await expect(applyMigrations(target, 'pyxis_app')).rejects.toThrow(
      'APP_DB_ROLE "pyxis_app" does not exist',
    );
    expect(target.calls).toEqual(['migrate', 'roleExists pyxis_app', 'close']);
  });

  it('closes the connection when a migration fails', async () => {
    const target = fakeTarget({ failMigrations: true });

    await expect(applyMigrations(target, 'pyxis_app')).rejects.toThrow('migration failed');
    expect(target.calls).toEqual(['migrate', 'close']);
  });
});

describe('migrationConnectionString', () => {
  it("prefers the owner's connection", () => {
    expect(
      migrationConnectionString({
        MIGRATION_DATABASE_URL: 'postgres://owner@db/pyxis',
        DATABASE_URL: 'postgres://app@db/pyxis',
      }),
    ).toBe('postgres://owner@db/pyxis');
  });

  it('falls back to DATABASE_URL, for a local database with a single role', () => {
    expect(
      migrationConnectionString({
        MIGRATION_DATABASE_URL: undefined,
        DATABASE_URL: 'postgres://app@db/pyxis',
      }),
    ).toBe('postgres://app@db/pyxis');
  });

  it('refuses to run without any connection string', () => {
    expect(() =>
      migrationConnectionString({ MIGRATION_DATABASE_URL: undefined, DATABASE_URL: undefined }),
    ).toThrow(MISSING_MIGRATION_URL_MESSAGE);
  });
});
