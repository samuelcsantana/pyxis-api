import { isLambdaRuntime } from './runtime';

describe('isLambdaRuntime', () => {
  it('is true when Lambda names the function', () => {
    expect(isLambdaRuntime({ AWS_LAMBDA_FUNCTION_NAME: 'pyxis-api' })).toBe(true);
  });

  it('is false anywhere else', () => {
    expect(isLambdaRuntime({})).toBe(false);
  });

  it('reads the process environment by default', () => {
    expect(isLambdaRuntime()).toBe(Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME));
  });
});
