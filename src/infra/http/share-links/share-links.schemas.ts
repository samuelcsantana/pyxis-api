import { z } from 'zod';
import type { Project } from '../../../domain/entities/project.entity';
import type { Goal } from '../../../domain/goals/goal';
import {
  MAX_SHARE_LINK_NAME_LENGTH,
  SHARE_TOKEN_PATTERN,
  type ShareLink,
} from '../../../domain/share-links/share-link';
import { goalBody, goalSchema } from '../goals/goals.schemas';

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
  })
  .meta({ id: 'CreateShareLink' });

const shareLinkShape = {
  id: z.uuid(),
  name: z.string(),
  created_at: z.iso.datetime(),
  expires_at: z.iso.datetime().nullable().describe('null: the link never expires'),
};

export const shareLinksSchema = z
  .strictObject({ links: z.array(z.strictObject(shareLinkShape)) })
  .meta({
    id: 'ShareLinks',
    description:
      'The share links of the project, the oldest first, expired ones included until the owner ' +
      'revokes them. Their tokens are never answered again.',
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
      'token, without signing in, while the account is on Pro.',
  });

export const sharedProjectSchema = z
  .strictObject({
    project: z.strictObject({
      name: z.string(),
      timezone: z.string().describe('The IANA time zone the days of every report are counted in'),
      currency: z.string().describe('The ISO 4217 currency of the revenue figures'),
      city_enabled: z.boolean().describe('Whether the project keeps the approximate city'),
      visitors_enabled: z.boolean().describe('Whether the project counts unique visitors'),
    }),
    goals: z.array(goalSchema).describe('The goals, in order; the reports take their ids in goal'),
    expires_at: z.iso.datetime().nullable().describe('null: the link never expires'),
  })
  .meta({
    id: 'SharedProject',
    description:
      'What a share link opens: the name and settings the shared reports need, and its goals.',
  });

export type CreateShareLinkBody = z.infer<typeof createShareLinkSchema>;
export type ShareLinksBody = z.infer<typeof shareLinksSchema>;
export type CreatedShareLinkBody = z.infer<typeof createdShareLinkSchema>;
export type SharedProjectBody = z.infer<typeof sharedProjectSchema>;

export function shareLinkBody(link: ShareLink): ShareLinksBody['links'][number] {
  return {
    id: link.id,
    name: link.name,
    created_at: link.createdAt.toISOString(),
    expires_at: link.expiresAt === null ? null : link.expiresAt.toISOString(),
  };
}

export function sharedProjectBody(
  link: ShareLink,
  project: Project,
  goals: readonly Goal[],
): SharedProjectBody {
  return {
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
