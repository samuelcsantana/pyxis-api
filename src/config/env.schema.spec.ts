import { DEFAULT_PORT, validateEnv } from './env.schema';

describe('validateEnv', () => {
  it('applies the defaults when nothing is set', () => {
    expect(validateEnv({})).toEqual({ NODE_ENV: 'development', PORT: DEFAULT_PORT });
  });

  it('coerces the port from the string the environment provides', () => {
    expect(validateEnv({ NODE_ENV: 'production', PORT: '8080' })).toEqual({
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
});
