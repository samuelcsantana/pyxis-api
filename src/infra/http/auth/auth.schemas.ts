import { z } from 'zod';
import { SESSION_TOKEN_PATTERN } from '../../../domain/auth/session-policy';
import { MAX_EMAIL_LENGTH } from '../../database/schema/admins';

const SIGN_IN_CODE_PATTERN = /^\d{6}$/;
const LANGUAGE_TAG_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{1,8})*$/;
export const MAX_LANGUAGE_TAG_LENGTH = 35;

const emailSchema = z.email().max(MAX_EMAIL_LENGTH);

const localeSchema = z
  .string()
  .max(MAX_LANGUAGE_TAG_LENGTH)
  .regex(LANGUAGE_TAG_PATTERN)
  .describe(
    'The language of the dashboard asking, as a BCP 47 tag (en, pt-BR). The email is written ' +
      'in it when the API has it (matched on the language, so pt-PT gets pt-BR), else in English.',
  );

export const requestCodeSchema = z
  .strictObject({ email: emailSchema, locale: localeSchema.optional() })
  .meta({
    id: 'RequestCodeRequest',
    description: 'The email to send a sign-in code to, and the language to write it in.',
  });

export const verifyCodeSchema = z
  .strictObject({ email: emailSchema, code: z.string().regex(SIGN_IN_CODE_PATTERN) })
  .meta({ id: 'VerifyCodeRequest', description: 'The email and the six-digit code it received.' });

export const signedInSchema = z
  .strictObject({
    email: z.email(),
    session_token: z
      .string()
      .regex(SESSION_TOKEN_PATTERN)
      .describe(
        'The opaque session token, for the dashboard to keep in a cookie of its own host. ' +
          'Stored only as a hash; never logged.',
      ),
  })
  .meta({
    id: 'SignedIn',
    description:
      'The signed-in admin and their session token. The dashboard keeps the token in an HttpOnly ' +
      'cookie and sends it back as the pyxis_session cookie on every call.',
  });

export const meSchema = z
  .strictObject({
    email: z.email(),
    projects: z.array(
      z.strictObject({
        id: z.uuid(),
        name: z.string(),
        timezone: z.string(),
        conversion_event: z.string().nullable(),
        first_event_at: z.iso
          .datetime()
          .nullable()
          .describe('When the oldest event kept for the project happened; null before the first'),
        last_event_at: z.iso
          .datetime()
          .nullable()
          .describe('When the newest event of the project happened; null before the first'),
      }),
    ),
  })
  .meta({ id: 'Me', description: 'The signed-in admin and the projects they may read.' });

export const sessionIdSchema = z.uuid();

export const sessionsSchema = z
  .strictObject({
    sessions: z.array(
      z.strictObject({
        id: z.uuid(),
        browser: z.string().nullable(),
        os: z.string().nullable(),
        device_type: z.string().nullable(),
        created_at: z.iso.datetime(),
        last_used_at: z.iso.datetime(),
        current: z.boolean().describe('Whether this is the session making the request'),
      }),
    ),
  })
  .meta({
    id: 'Sessions',
    description:
      'The live sessions of the signed-in admin, the most recently used first. Browser, system ' +
      'and device type are the families classified at sign-in (chrome, windows, desktop…), null ' +
      'for a session that predates them; the user agent and the address are never kept.',
  });

export type SessionsBody = z.infer<typeof sessionsSchema>;
export type RequestCodeBody = z.infer<typeof requestCodeSchema>;
export type VerifyCodeBody = z.infer<typeof verifyCodeSchema>;
export type SignedInBody = z.infer<typeof signedInSchema>;
export type MeBody = z.infer<typeof meSchema>;
