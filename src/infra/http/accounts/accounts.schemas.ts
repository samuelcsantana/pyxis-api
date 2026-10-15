import { z } from 'zod';
import { ACCOUNT_STATUSES } from '../../../domain/accounts/account-status';
import { MAX_TERMS_VERSION_LENGTH } from '../../../domain/accounts/sign-up-policy';
import { SESSION_TOKEN_PATTERN } from '../../../domain/auth/session-policy';
import { BILLING_INTERVALS } from '../../../domain/billing/billing-gateway';
import { emailSchema, localeSchema, signInCodeSchema } from '../auth/auth.schemas';

export const signUpStatusSchema = z
  .strictObject({
    open: z.boolean(),
    terms_version: z
      .string()
      .nullable()
      .describe('The version of the terms the sign-up page must show; null while closed.'),
    terms_url: z
      .url()
      .nullable()
      .describe('Where the terms of that version are published; null while closed.'),
  })
  .meta({ id: 'SignUpStatus', description: 'Whether anyone can create an account now.' });

export const signUpCodeSchema = z
  .strictObject({ email: emailSchema, locale: localeSchema.optional() })
  .meta({
    id: 'SignUpCodeRequest',
    description: 'The email to send a sign-up code to, and the language to write it in.',
  });

export const signUpSchema = z
  .strictObject({
    email: emailSchema,
    code: signInCodeSchema,
    terms_version: z
      .string()
      .min(1)
      .max(MAX_TERMS_VERSION_LENGTH)
      .describe('The version of the terms the person read and accepted on the sign-up page.'),
  })
  .meta({
    id: 'SignUpRequest',
    description: 'The email, the six-digit code it received and the version of the terms accepted.',
  });

export const signedUpSchema = z
  .strictObject({
    email: z.email(),
    session_token: z.string().regex(SESSION_TOKEN_PATTERN),
    account_id: z.uuid(),
  })
  .meta({
    id: 'SignedUp',
    description:
      'The new (or returning) owner, their session token, kept by the dashboard like a sign-in, ' +
      'and the account waiting for its subscription.',
  });

export const checkoutRequestSchema = z
  .strictObject({ interval: z.enum(BILLING_INTERVALS), locale: localeSchema.optional() })
  .meta({ id: 'CheckoutRequest', description: 'The billing period and the page language.' });

export const portalRequestSchema = z
  .strictObject({ locale: localeSchema.optional() })
  .meta({ id: 'PortalRequest', description: 'The language of the billing portal.' });

export const billingRedirectSchema = z
  .strictObject({ url: z.url() })
  .meta({ id: 'BillingRedirect', description: 'Where to send the browser next, on Stripe.' });

const isoDate = z.iso.datetime().nullable();

export const myAccountsSchema = z
  .strictObject({
    accounts: z.array(
      z.strictObject({
        id: z.uuid(),
        role: z.enum(['owner', 'member']),
        status: z.enum(ACCOUNT_STATUSES),
        billing_interval: z.enum(BILLING_INTERVALS).nullable(),
        trial_ends_at: isoDate,
        current_period_ends_at: isoDate,
        access_ends_at: isoDate,
        ingestion_paused_until: isoDate,
        quota_pause_exempt_until: isoDate.describe(
          'Until when the operator exempts the account from the pause at 150% of the plan (a ' +
            'customer of an earlier version of the terms, until its renewal); null when it is not.',
        ),
        suspended_at: isoDate.describe(
          'Set while the operator suspended the account for abuse: its projects take no events ' +
            'and answer account_suspended in the dashboard until it is lifted.',
        ),
        suspension_reason: z
          .string()
          .nullable()
          .describe('Why the account is suspended, as told to the owner; null for members.'),
        deletion_held_at: isoDate.describe(
          'Set while the operator holds the deletion of the account (a dispute or a legal order): ' +
            'nothing of it is deleted, and its projects cannot be deleted, until it is released. ' +
            'Null for members.',
        ),
        month: z.string().describe('The calendar month in UTC the usage is counted in, YYYY-MM.'),
        events_this_month: z
          .number()
          .int()
          .nullable()
          .describe('Events counted by the last daily measurement; null before the first.'),
        measured_at: isoDate,
        limits: z.strictObject({
          events_per_month: z.number().int(),
          projects: z.number().int(),
          people: z.number().int(),
        }),
      }),
    ),
  })
  .meta({
    id: 'MyAccounts',
    description:
      'The accounts the signed-in admin owns or reads a project of, with their billing state for ' +
      'owners and the month measured so far.',
  });

export const closeAccountSchema = z
  .strictObject({
    confirm_email: emailSchema.describe("The owner's e-mail address, typed again to confirm"),
  })
  .meta({ id: 'CloseAccountRequest', description: 'The confirmation of a closure.' });

export const closedAccountSchema = z
  .strictObject({
    access_ends_at: z.iso.datetime(),
    deletion_on: z.iso
      .datetime()
      .describe('When the projects, their events and their keys are deleted for good'),
    refunded_amount: z
      .int()
      .describe(
        'What was refunded, in the smallest unit of the currency (centavos); 0 for nothing',
      ),
  })
  .meta({
    id: 'ClosedAccount',
    description: 'The account, closed now: its keys are revoked and its data waits for deletion.',
  });

export const accountIdSchema = z.uuid();

export type SignUpStatusBody = z.infer<typeof signUpStatusSchema>;
export type SignUpCodeBody = z.infer<typeof signUpCodeSchema>;
export type SignUpBody = z.infer<typeof signUpSchema>;
export type SignedUpBody = z.infer<typeof signedUpSchema>;
export type CheckoutRequestBody = z.infer<typeof checkoutRequestSchema>;
export type PortalRequestBody = z.infer<typeof portalRequestSchema>;
export type BillingRedirectBody = z.infer<typeof billingRedirectSchema>;
export type MyAccountsBody = z.infer<typeof myAccountsSchema>;
export type CloseAccountBody = z.infer<typeof closeAccountSchema>;
export type ClosedAccountBody = z.infer<typeof closedAccountSchema>;
