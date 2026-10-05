export function isLambdaRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.AWS_LAMBDA_FUNCTION_NAME);
}
