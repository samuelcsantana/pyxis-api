import { Logger } from '@nestjs/common';
import { DatabaseRoleCheck } from './database-role.check';
import type { DrizzleDatabase } from './drizzle.types';

function checkWith(execute: jest.Mock): DatabaseRoleCheck {
  return new DatabaseRoleCheck({ execute } as unknown as DrizzleDatabase);
}

describe('DatabaseRoleCheck', () => {
  let log: jest.SpyInstance;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reports a role without DDL rights as ok', async () => {
    await checkWith(
      jest.fn().mockResolvedValue([{ role: 'pyxis_app', can_create: false }]),
    ).onApplicationBootstrap();

    expect(log).toHaveBeenCalledWith('database.role_ok { role: "pyxis_app" }');
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns when the connected role can create objects', async () => {
    await checkWith(
      jest.fn().mockResolvedValue([{ role: 'pyxis', can_create: true }]),
    ).tryReportDatabaseRole();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('database.role_can_create'));
    expect(log).not.toHaveBeenCalled();
  });

  it('warns when the query returns no row', async () => {
    await checkWith(jest.fn().mockResolvedValue([])).tryReportDatabaseRole();

    expect(warn).toHaveBeenCalledWith('database.role_check_empty');
  });

  it('logs and swallows a database error, so the API still starts', async () => {
    await checkWith(
      jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED')),
    ).tryReportDatabaseRole();

    expect(warn).toHaveBeenCalledWith(
      'database.role_check_failed { message: "connect ECONNREFUSED" }',
    );
  });

  it('logs a non-Error failure as text', async () => {
    await checkWith(jest.fn().mockRejectedValue('timeout')).tryReportDatabaseRole();

    expect(warn).toHaveBeenCalledWith('database.role_check_failed { message: "timeout" }');
  });
});
