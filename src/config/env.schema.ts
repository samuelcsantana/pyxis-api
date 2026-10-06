import { z } from 'zod';

export const DEFAULT_PORT = 3040;
export const DEFAULT_MAIL_FROM = 'Pyxis <noreply@samuelsantana.dev>';

export const POSTGRES_ROLE_NAME = /^[a-z_][a-z0-9_]{0,62}$/;
export const HTTP_HEADER_NAME = /^[a-z0-9-]+$/;
export const COOKIE_DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

const emptyAsUnset = (value: unknown): unknown => (value === '' ? undefined : value);

const postgresUrl = z.url({ protocol: /^postgres(ql)?$/ });

const isBareOrigin = (value: string): boolean =>
  URL.canParse(value) && new URL(value).origin === value;

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(DEFAULT_PORT),
    SWAGGER_ENABLED: z.preprocess(emptyAsUnset, z.enum(['true', 'false']).optional()),
    DATABASE_URL: z.preprocess(emptyAsUnset, postgresUrl.optional()),
    MIGRATION_DATABASE_URL: z.preprocess(emptyAsUnset, postgresUrl.optional()),
    APP_DB_ROLE: z.preprocess(emptyAsUnset, z.string().regex(POSTGRES_ROLE_NAME).optional()),
    CLIENT_IP_HEADER: z.preprocess(
      emptyAsUnset,
      z.string().toLowerCase().regex(HTTP_HEADER_NAME).optional(),
    ),
    RESEND_API_KEY: z.preprocess(emptyAsUnset, z.string().optional()),
    MAIL_FROM: z.preprocess(emptyAsUnset, z.string().default(DEFAULT_MAIL_FROM)),
    DASHBOARD_ORIGIN: z.preprocess(
      emptyAsUnset,
      z
        .url({ protocol: /^https?$/ })
        .refine(isBareOrigin, 'Write the origin only: scheme, host and port')
        .optional(),
    ),
    SESSION_COOKIE_DOMAIN: z.preprocess(emptyAsUnset, z.string().regex(COOKIE_DOMAIN).optional()),
  })
  .refine((env) => env.NODE_ENV !== 'production' || env.RESEND_API_KEY !== undefined, {
    path: ['RESEND_API_KEY'],
    message: 'RESEND_API_KEY is required in production, where sign-in codes are never logged',
  })
  .refine((env) => env.NODE_ENV !== 'production' || env.DASHBOARD_ORIGIN !== undefined, {
    path: ['DASHBOARD_ORIGIN'],
    message: 'DASHBOARD_ORIGIN is required in production, for the dashboard CORS and Origin checks',
  });

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
