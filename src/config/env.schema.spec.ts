import { DEFAULT_PORT, validateEnv } from './env.schema';

describe('validateEnv', () => {
  it('applies the defaults when nothing is set', () => {
    expect(validateEnv({})).toEqual({
      NODE_ENV: 'development',
      PORT: DEFAULT_PORT,
      SWAGGER_ENABLED: undefined,
      DATABASE_URL: undefined,
      MIGRATION_DATABASE_URL: undefined,
      APP_DB_ROLE: undefined,
    });
  });

  it('coerces the port from the string the environment provides', () => {
    expect(validateEnv({ NODE_ENV: 'production', PORT: '8080' })).toMatchObject({
      NODE_ENV: 'production',
      PORT: 8080,
    });
  });

  it('rejects a port outside the TCP range', () => {
    expect(() => validateEnv({ PORT: '70000' })).toThrow('Invalid environment configuration');
  });

  it('rejects an unknown NODE_ENV and names the variable', () => {
    expect(() => validateEnv({ NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });

  it('treats an empty SWAGGER_ENABLED as unset', () => {
    expect(validateEnv({ SWAGGER_ENABLED: '' }).SWAGGER_ENABLED).toBeUndefined();
  });

  it('keeps an explicit SWAGGER_ENABLED', () => {
    expect(validateEnv({ SWAGGER_ENABLED: 'false' }).SWAGGER_ENABLED).toBe('false');
  });

  it('rejects a SWAGGER_ENABLED that is not true or false', () => {
    expect(() => validateEnv({ SWAGGER_ENABLED: 'yes' })).toThrow(/SWAGGER_ENABLED/);
  });

  it('accepts postgres and postgresql connection strings', () => {
    const env = validateEnv({
      DATABASE_URL: 'postgresql://pyxis_app:secret@db:5432/pyxis?sslmode=verify-full',
      MIGRATION_DATABASE_URL: 'postgres://pyxis:secret@db:5432/pyxis',
    });

    expect(env.DATABASE_URL).toBe(
      'postgresql://pyxis_app:secret@db:5432/pyxis?sslmode=verify-full',
    );
    expect(env.MIGRATION_DATABASE_URL).toBe('postgres://pyxis:secret@db:5432/pyxis');
  });

  it('rejects a connection string for another protocol', () => {
    expect(() => validateEnv({ DATABASE_URL: 'mysql://user@host/db' })).toThrow(/DATABASE_URL/);
  });

  it('treats empty database variables as unset', () => {
    const env = validateEnv({ DATABASE_URL: '', MIGRATION_DATABASE_URL: '', APP_DB_ROLE: '' });

    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.MIGRATION_DATABASE_URL).toBeUndefined();
    expect(env.APP_DB_ROLE).toBeUndefined();
  });

  it('accepts a lower-case Postgres identifier as the application role', () => {
    expect(validateEnv({ APP_DB_ROLE: 'pyxis_app' }).APP_DB_ROLE).toBe('pyxis_app');
  });

  it('rejects an application role that is not a plain identifier', () => {
    expect(() => validateEnv({ APP_DB_ROLE: 'pyxis_app; DROP TABLE events' })).toThrow(
      /APP_DB_ROLE/,
    );
  });

  it('reads the trusted client address header in lower case', () => {
    expect(validateEnv({ CLIENT_IP_HEADER: 'CloudFront-Viewer-Address' }).CLIENT_IP_HEADER).toBe(
      'cloudfront-viewer-address',
    );
  });

  it('treats an empty CLIENT_IP_HEADER as unset', () => {
    expect(validateEnv({ CLIENT_IP_HEADER: '' }).CLIENT_IP_HEADER).toBeUndefined();
  });

  it('rejects a CLIENT_IP_HEADER that is not a header name', () => {
    expect(() => validateEnv({ CLIENT_IP_HEADER: 'x-real-ip: 1.2.3.4' })).toThrow(
      /CLIENT_IP_HEADER/,
    );
  });
});
