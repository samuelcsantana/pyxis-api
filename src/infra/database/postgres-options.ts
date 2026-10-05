import type { Options } from 'postgres';
import { isLambdaRuntime } from '../../shared/utils/runtime';

export const CONNECT_TIMEOUT_SECONDS = 10;

export const LAMBDA_CLIENT_OPTIONS = {
  prepare: false,
  max: 5,
  idle_timeout: 240,
  fetch_types: false,
} as const;

export function postgresClientOptions(
  env: NodeJS.ProcessEnv = process.env,
): Options<Record<string, never>> {
  const base = { connect_timeout: CONNECT_TIMEOUT_SECONDS };
  return isLambdaRuntime(env) ? { ...base, ...LAMBDA_CLIENT_OPTIONS } : base;
}
