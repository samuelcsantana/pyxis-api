import { z } from 'zod';
import { MAX_EMAIL_LENGTH } from '../../database/schema/admins';

const SIGN_IN_CODE_PATTERN = /^\d{6}$/;

const emailSchema = z.email().max(MAX_EMAIL_LENGTH);

export const requestCodeSchema = z
  .strictObject({ email: emailSchema })
  .meta({ id: 'RequestCodeRequest', description: 'The email to send a sign-in code to.' });

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
      }),
    ),
  })
  .meta({ id: 'Me', description: 'The signed-in admin and the projects they may read.' });

export type RequestCodeBody = z.infer<typeof requestCodeSchema>;
export type VerifyCodeBody = z.infer<typeof verifyCodeSchema>;
export type SignedInBody = z.infer<typeof signedInSchema>;
export type MeBody = z.infer<typeof meSchema>;
