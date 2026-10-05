import {
  CONNECT_TIMEOUT_SECONDS,
  LAMBDA_CLIENT_OPTIONS,
  postgresClientOptions,
} from './postgres-options';

describe('postgresClientOptions', () => {
  it('only bounds the connection time outside Lambda', () => {
    expect(postgresClientOptions({})).toEqual({ connect_timeout: CONNECT_TIMEOUT_SECONDS });
  });

  it('tunes the pool for the pooler and frozen environments on Lambda', () => {
    expect(postgresClientOptions({ AWS_LAMBDA_FUNCTION_NAME: 'pyxis-api' })).toEqual({
      connect_timeout: CONNECT_TIMEOUT_SECONDS,
      ...LAMBDA_CLIENT_OPTIONS,
    });
  });

  it('turns prepared statements off on Lambda, which the transaction pooler cannot keep', () => {
    expect(postgresClientOptions({ AWS_LAMBDA_FUNCTION_NAME: 'pyxis-api' }).prepare).toBe(false);
  });

  it('reads the process environment by default', () => {
    expect(postgresClientOptions().connect_timeout).toBe(CONNECT_TIMEOUT_SECONDS);
  });
});
