import { z } from 'zod';

export const DEFAULT_PORT = 3040;

export const POSTGRES_ROLE_NAME = /^[a-z_][a-z0-9_]{0,62}$/;

const emptyAsUnset = (value: unknown): unknown => (value === '' ? undefined : value);

const postgresUrl = z.url({ protocol: /^postgres(ql)?$/ });

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(DEFAULT_PORT),
  SWAGGER_ENABLED: z.preprocess(emptyAsUnset, z.enum(['true', 'false']).optional()),
  DATABASE_URL: z.preprocess(emptyAsUnset, postgresUrl.optional()),
  MIGRATION_DATABASE_URL: z.preprocess(emptyAsUnset, postgresUrl.optional()),
  APP_DB_ROLE: z.preprocess(emptyAsUnset, z.string().regex(POSTGRES_ROLE_NAME).optional()),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
