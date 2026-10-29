import { z } from 'zod';
import { ACCOUNT_STATUSES } from '../../../domain/accounts/account-status';
import { FREE_PLACES, FREE_PLAN_STATES } from '../../../domain/accounts/free-plan-sign-up';
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
    free_plan: z
      .enum(FREE_PLAN_STATES)
      .describe(
        'open: a new owner starts on the free plan, with no card; full: the free plan holds its ' +
          'maximum of accounts, so a new owner subscribes or waits for a place; closed: sign-up ' +
          'goes through Checkout, as before the free plan.',
      ),
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
    account_status: z
      .enum(ACCOUNT_STATUSES)
      .describe(
        'free when the owner starts on the free plan; incomplete when the account waits for its ' +
          'subscription (the free plan closed or full); another status when a returning owner ' +
          'gets an account that already runs.',
      ),
    free_place: z
      .enum(FREE_PLACES)
      .describe(
        'placed when the account took a place on the free plan; waitlisted when it waits for one; ' +
          'taken_by_same_mailbox when the mailbox behind the address (the address without its ' +
          '+tag, and on Gmail without dots) already has an account on the free plan or waiting ' +
          'for one, so this account waits for its subscription; not_offered when the free plan ' +
          'is closed or a returning owner gets an account that already runs.',
      ),
  })
  .meta({
    id: 'SignedUp',
    description:
      'The new (or returning) owner, their session token, kept by the dashboard like a sign-in, ' +
      'and their account: on the free plan, or waiting for its subscription.',
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
          'Until when the operator exempts the account from the pause past its monthly events (a ' +
            'customer of an earlier version of the terms, until its renewal); null when it is not.',
        ),
        free_waitlisted_at: isoDate.describe(
          'Since when an unfinished account waits for a place on the free plan, which was full at ' +
            'sign-up; null when it does not wait. Its owner can subscribe in the meantime.',
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
        free_plan_fit_due_at: isoDate.describe(
          'Set after a withdrawal left the account on the free plan with more projects or people ' +
            'than it holds: on that day the account ends unless it fits by then. Null for members.',
        ),
        project_count: z
          .number()
          .int()
          .nullable()
          .describe('How many projects the account holds now; null for members.'),
        people_count: z
          .number()
          .int()
          .nullable()
          .describe(
            'How many people, the owner included, read a project of the account now; null for ' +
              'members.',
          ),
        bound_by_free_plan_terms: z
          .boolean()
          .nullable()
          .describe(
            'Whether terms with the free plan bind the account now: its owner accepted them, or ' +
              'the day they reach earlier accounts has passed. Only then does a subscription that ' +
              'ends fall back to the free plan, when the plan is open and the account fits it; ' +
              'otherwise it ends as the earlier terms say. Null for members.',
          ),
        mailbox_has_another_free_account: z
          .boolean()
          .nullable()
          .describe(
            'Whether another account on the free plan belongs to the mailbox of the owner (the ' +
              'address without its +tag, and on Gmail without dots). Only one free account is ' +
              'kept per mailbox, so a subscription that ends then ends the account instead of ' +
              'falling back to the free plan. Null for members.',
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
          pause_at_events: z
            .number()
            .int()
            .describe(
              'Events this month at which the daily measurement pauses measuring until the 1st: ' +
                '100% of the monthly limit on the free plan, 150% on the paid one.',
            ),
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

export const withdrawnSchema = z
  .strictObject({
    status: z.literal('free'),
    refunded_amount: z
      .int()
      .describe(
        'What was refunded of the first payment, in the smallest unit of the currency ' +
          '(centavos); 0 when the automatic refund failed and is done by hand',
      ),
    fit_by: z.iso
      .datetime()
      .nullable()
      .describe(
        "When an account over the free plan's projects or people ends unless it fits by then; " +
          'null when it already fits',
      ),
  })
  .meta({
    id: 'Withdrawn',
    description:
      'The subscription cancelled now and its first payment refunded: the account is back on the free plan.',
  });

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
export type WithdrawnBody = z.infer<typeof withdrawnSchema>;
export type ClosedAccountBody = z.infer<typeof closedAccountSchema>;
