import { z } from 'zod';
import {
  ACCESS_TOKEN_LIFETIMES_DAYS,
  ACCESS_TOKEN_PATTERN,
  DEFAULT_ACCESS_TOKEN_LIFETIME_DAYS,
  MAX_ACCESS_TOKEN_NAME_LENGTH,
} from '../../../domain/auth/access-token-policy';

export const accessTokenIdSchema = z.uuid();

export const createAccessTokenSchema = z
  .strictObject({
    name: z
      .string()
      .trim()
      .min(1)
      .max(MAX_ACCESS_TOKEN_NAME_LENGTH)
      .describe('What the token is for, as the admin will recognize it in the list'),
    expires_in_days: z
      .literal([...ACCESS_TOKEN_LIFETIMES_DAYS])
      .default(DEFAULT_ACCESS_TOKEN_LIFETIME_DAYS)
      .describe('How long the token lives: 30, 90 (the default) or 365 days'),
  })
  .meta({ id: 'CreateAccessToken' });

const accessTokenFields = {
  id: z.uuid(),
  name: z.string(),
  created_at: z.iso.datetime(),
  expires_at: z.iso.datetime(),
};

export const accessTokensSchema = z
  .strictObject({
    tokens: z.array(
      z.strictObject({
        ...accessTokenFields,
        last_used_at: z.iso
          .datetime()
          .nullable()
          .describe('Recorded at most every five minutes; null before the first use'),
      }),
    ),
  })
  .meta({
    id: 'AccessTokens',
    description:
      'The live access tokens of the signed-in admin, the newest first: neither revoked nor ' +
      'expired. The tokens themselves are never answered again.',
  });

export const createdAccessTokenSchema = z
  .strictObject({
    ...accessTokenFields,
    token: z
      .string()
      .regex(ACCESS_TOKEN_PATTERN)
      .describe('Answered this once: only its hash is kept'),
  })
  .meta({
    id: 'CreatedAccessToken',
    description:
      'A read-only token for the dashboard queries and GET /v1/me, sent as Authorization: ' +
      'Bearer pyxis_at_…; it never writes, never signs in and never manages tokens.',
  });

export type CreateAccessTokenBody = z.infer<typeof createAccessTokenSchema>;
export type AccessTokensBody = z.infer<typeof accessTokensSchema>;
export type CreatedAccessTokenBody = z.infer<typeof createdAccessTokenSchema>;
