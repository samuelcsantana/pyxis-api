const FUNCTION_NAME_IN_TESTS = 'pyxis-api-tests';

export function connectAsTheLambdaDoes(): void {
  process.env.AWS_LAMBDA_FUNCTION_NAME = FUNCTION_NAME_IN_TESTS;
}
