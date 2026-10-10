import { DEFAULT_MAIL_FROM, DEFAULT_PORT, validateEnv, validateServerEnv } from './env.schema';

const DASHBOARD_ORIGIN = 'https://pyxis.example.com';
const PRODUCTION = { NODE_ENV: 'production', RESEND_API_KEY: 'key', DASHBOARD_ORIGIN };

describe('validateEnv', () => {
  it('applies the defaults when nothing is set', () => {
    expect(validateEnv({})).toEqual({
      NODE_ENV: 'development',
      PORT: DEFAULT_PORT,
      SWAGGER_ENABLED: undefined,
      DATABASE_URL: undefined,
      MIGRATION_DATABASE_URL: undefined,
      APP_DB_ROLE: undefined,
      MAIL_FROM: DEFAULT_MAIL_FROM,
    });
  });

  it('coerces the port from the string the environment provides', () => {
    expect(validateEnv({ ...PRODUCTION, PORT: '8080' })).toMatchObject({
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

  it.each(['https://pyxis.example.com', 'http://localhost:3000'])(
    'accepts %s as the dashboard origin',
    (origin) => {
      expect(validateEnv({ DASHBOARD_ORIGIN: origin }).DASHBOARD_ORIGIN).toBe(origin);
    },
  );

  it.each([
    ['a path', 'https://pyxis.example.com/sign-in'],
    ['a trailing slash', 'https://pyxis.example.com/'],
    ['another scheme', 'ftp://pyxis.example.com'],
    ['no scheme', 'pyxis.example.com'],
  ])('rejects a dashboard origin with %s', (_case, origin) => {
    expect(() => validateEnv({ DASHBOARD_ORIGIN: origin })).toThrow(/DASHBOARD_ORIGIN/);
  });

  it('treats an empty DASHBOARD_ORIGIN as unset', () => {
    expect(validateEnv({ DASHBOARD_ORIGIN: '' }).DASHBOARD_ORIGIN).toBeUndefined();
  });
});

describe('validateServerEnv', () => {
  it('refuses production without a Resend key, so codes can never be logged there', () => {
    expect(() => validateServerEnv({ NODE_ENV: 'production', DASHBOARD_ORIGIN })).toThrow(
      /RESEND_API_KEY/,
    );
  });

  it('refuses production without the dashboard origin it lets sign in', () => {
    expect(() => validateServerEnv({ NODE_ENV: 'production', RESEND_API_KEY: 'key' })).toThrow(
      /DASHBOARD_ORIGIN/,
    );
  });

  it('accepts production with a Resend key, the dashboard origin and a sender of its own', () => {
    expect(validateServerEnv({ ...PRODUCTION, MAIL_FROM: 'Ops <ops@example.com>' })).toMatchObject({
      RESEND_API_KEY: 'key',
      DASHBOARD_ORIGIN,
      MAIL_FROM: 'Ops <ops@example.com>',
    });
  });

  it('runs without either outside production', () => {
    const env = validateServerEnv({ NODE_ENV: 'development' });

    expect(env.RESEND_API_KEY).toBeUndefined();
    expect(env.DASHBOARD_ORIGIN).toBeUndefined();
  });

  it('still rejects what the shared schema rejects', () => {
    expect(() => validateServerEnv({ PORT: '70000' })).toThrow('Invalid environment configuration');
  });
});

describe('validateEnv in production', () => {
  it('lets the migration and the scripts run without the server-only settings', () => {
    const env = validateEnv({
      NODE_ENV: 'production',
      MIGRATION_DATABASE_URL: 'postgres://pyxis:secret@db:5432/pyxis',
    });

    expect(env.NODE_ENV).toBe('production');
    expect(env.RESEND_API_KEY).toBeUndefined();
    expect(env.DASHBOARD_ORIGIN).toBeUndefined();
  });
});
