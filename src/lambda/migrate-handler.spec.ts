import { Logger } from '@nestjs/common';
import { createMigrateHandler } from './migrate-handler';

describe('createMigrateHandler', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads the parameters, then migrates with the owner URL and grants the app role', async () => {
    const env: NodeJS.ProcessEnv = {};
    const loadParameters = jest.fn(() => {
      env.MIGRATION_DATABASE_URL = 'postgres://owner@db/pyxis';
      env.APP_DB_ROLE = 'pyxis_app';
      return Promise.resolve();
    });
    const migrate = jest.fn(() => Promise.resolve({ grantedTo: 'pyxis_app' }));

    const outcome = await createMigrateHandler({ loadParameters, migrate, env })();

    expect(outcome).toEqual({ ok: true, grantedTo: 'pyxis_app' });
    expect(migrate).toHaveBeenCalledWith('postgres://owner@db/pyxis', 'pyxis_app');
  });

  it('refuses to fall back to the application URL', async () => {
    const migrate = jest.fn();
    const handler = createMigrateHandler({
      loadParameters: () => Promise.resolve(),
      migrate,
      env: { DATABASE_URL: 'postgres://app@db/pyxis' },
    });

    await expect(handler()).rejects.toThrow('MIGRATION_DATABASE_URL');
    expect(migrate).not.toHaveBeenCalled();
  });
});
