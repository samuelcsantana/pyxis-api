import { z } from 'zod';
import type { Project } from '../../../domain/entities/project.entity';
import type { Goal } from '../../../domain/goals/goal';
import {
  MAX_SHARE_LINK_NAME_LENGTH,
  SHARE_TOKEN_PATTERN,
  type ShareLink,
} from '../../../domain/share-links/share-link';
import {
  MAX_SHARE_PASSWORD_INPUT_UNITS,
  MAX_SHARE_PASSWORD_LENGTH,
  MIN_SHARE_PASSWORD_LENGTH,
  SHARE_UNLOCK_PATTERN,
} from '../../../domain/share-links/share-unlock';
import { goalBody, goalSchema } from '../goals/goals.schemas';

const passwordSchema = z
  .string()
  .max(MAX_SHARE_PASSWORD_INPUT_UNITS)
  .describe(
    `${String(MIN_SHARE_PASSWORD_LENGTH)} to ${String(MAX_SHARE_PASSWORD_LENGTH)} characters, ` +
      'kept exactly as typed and stored only as a scrypt hash',
  );

export const createShareLinkSchema = z
  .strictObject({
    name: z
      .string()
      .trim()
      .min(1)
      .max(MAX_SHARE_LINK_NAME_LENGTH)
      .describe('Who the link is for, as the owner will recognize it in the list'),
    expires_at: z.iso
      .datetime()
      .nullable()
      .default(null)
      .describe('When the link stops opening, after now; null or absent: it never expires'),
    password: passwordSchema
      .nullable()
      .default(null)
      .describe('A password the viewer must type before the reports open; null or absent: none'),
  })
  .meta({ id: 'CreateShareLink' });

export const shareLinkPasswordSchema = z
  .strictObject({
    password: passwordSchema
      .nullable()
      .describe('The new password; null removes it. Either way the open unlocks stop working'),
  })
  .meta({ id: 'ShareLinkPassword' });

export const unlockShareLinkSchema = z
  .strictObject({ password: passwordSchema })
  .meta({ id: 'UnlockShareLink' });

export const shareUnlockSchema = z
  .strictObject({
    unlock: z
      .string()
      .regex(SHARE_UNLOCK_PATTERN)
      .describe(
        'Sent as Authorization: Bearer pyxis_su_… with every /v1/shared/{token} call of this ' +
          'link; keep it in memory or the tab’s sessionStorage',
      ),
    expires_at: z.iso.datetime().describe('When the unlock stops opening the reports'),
  })
  .meta({
    id: 'ShareUnlock',
    description:
      'Opens the reports of one password-protected link for a few hours. It stops at once when ' +
      'the owner changes or removes the password or revokes the link.',
  });

const shareLinkShape = {
  id: z.uuid(),
  name: z.string(),
  created_at: z.iso.datetime(),
  expires_at: z.iso.datetime().nullable().describe('null: the link never expires'),
  password_protected: z.boolean().describe('Whether the viewer must type a password'),
};

export const shareLinkSchema = z.strictObject(shareLinkShape).meta({ id: 'ShareLink' });

export const shareLinksSchema = z.strictObject({ links: z.array(shareLinkSchema) }).meta({
  id: 'ShareLinks',
  description:
    'The share links of the project, the oldest first, expired ones included until the owner ' +
    'revokes them. Their tokens and passwords are never answered.',
});

export const createdShareLinkSchema = z
  .strictObject({
    ...shareLinkShape,
    token: z
      .string()
      .regex(SHARE_TOKEN_PATTERN)
      .describe('Answered this once: only its hash is kept. The public routes take it in the path'),
  })
  .meta({
    id: 'CreatedShareLink',
    description:
      'A read-only link to the aggregate reports of one project, opened by anyone who has the ' +
      'token, and the password when it has one, without signing in, while the account is on Pro.',
  });

const lockedProjectSchema = z
  .strictObject({ password_required: z.literal(true) })
  .describe('The link has a password and no valid unlock was sent: nothing else is answered');

const openProjectSchema = z.strictObject({
  password_required: z.literal(false),
  project: z.strictObject({
    name: z.string(),
    timezone: z.string().describe('The IANA time zone the days of every report are counted in'),
    currency: z.string().describe('The ISO 4217 currency of the revenue figures'),
    city_enabled: z.boolean().describe('Whether the project keeps the approximate city'),
    visitors_enabled: z.boolean().describe('Whether the project counts unique visitors'),
  }),
  goals: z.array(goalSchema).describe('The goals, in order; the reports take their ids in goal'),
  expires_at: z.iso.datetime().nullable().describe('null: the link never expires'),
});

export const sharedProjectSchema = z
  .discriminatedUnion('password_required', [lockedProjectSchema, openProjectSchema])
  .meta({
    id: 'SharedProject',
    description:
      'What a share link opens: the name and settings the shared reports need, and its goals; ' +
      'only password_required: true for a password-protected link not unlocked yet.',
  });

export type CreateShareLinkBody = z.infer<typeof createShareLinkSchema>;
export type ShareLinkPasswordBody = z.infer<typeof shareLinkPasswordSchema>;
export type UnlockShareLinkBody = z.infer<typeof unlockShareLinkSchema>;
export type ShareUnlockBody = z.infer<typeof shareUnlockSchema>;
export type ShareLinkBody = z.infer<typeof shareLinkSchema>;
export type ShareLinksBody = z.infer<typeof shareLinksSchema>;
export type CreatedShareLinkBody = z.infer<typeof createdShareLinkSchema>;
export type SharedProjectBody = z.infer<typeof sharedProjectSchema>;

export const LOCKED_PROJECT_BODY: SharedProjectBody = { password_required: true };

export function shareLinkBody(link: ShareLink): ShareLinkBody {
  return {
    id: link.id,
    name: link.name,
    created_at: link.createdAt.toISOString(),
    expires_at: link.expiresAt === null ? null : link.expiresAt.toISOString(),
    password_protected: link.passwordProtected,
  };
}

export function sharedProjectBody(
  link: ShareLink,
  project: Project,
  goals: readonly Goal[],
): SharedProjectBody {
  return {
    password_required: false,
    project: {
      name: project.name,
      timezone: project.timezone,
      currency: project.currency,
      city_enabled: project.cityEnabled,
      visitors_enabled: project.visitorsEnabled,
    },
    goals: goals.map(goalBody),
    expires_at: link.expiresAt === null ? null : link.expiresAt.toISOString(),
  };
}
