import { DEFAULT_PORT, validateEnv } from './env.schema';

describe('validateEnv', () => {
  it('applies the defaults when nothing is set', () => {
    expect(validateEnv({})).toEqual({
      NODE_ENV: 'development',
      PORT: DEFAULT_PORT,
      SWAGGER_ENABLED: undefined,
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
});
