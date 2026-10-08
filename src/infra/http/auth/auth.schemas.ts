import { z } from 'zod';
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
  .strictObject({ email: z.email() })
  .meta({ id: 'SignedIn', description: 'The signed-in admin; the session travels in a cookie.' });

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

export type RequestCodeBody = z.infer<typeof requestCodeSchema>;
export type VerifyCodeBody = z.infer<typeof verifyCodeSchema>;
export type SignedInBody = z.infer<typeof signedInSchema>;
export type MeBody = z.infer<typeof meSchema>;
