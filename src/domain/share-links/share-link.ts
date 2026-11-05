import { InvalidShareLinkError } from '../errors/share-link.errors';
import { randomKeyBody } from '../keys/project-keys';
import type { RandomSource } from '../services/random-source';

export const SHARE_TOKEN_PREFIX = 'pyxis_sh_';
export const SHARE_TOKEN_PATTERN = /^pyxis_sh_[A-Za-z0-9]{32}$/;
export const MAX_SHARE_LINKS_PER_PROJECT = 10;
export const MAX_SHARE_LINK_NAME_LENGTH = 64;

export interface ShareLink {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly createdAt: Date;
  readonly expiresAt: Date | null;
}

export interface ShareLinkDraft {
  readonly name: string;
  readonly expiresAt: Date | null;
}

export function generateShareToken(random: RandomSource): string {
  return `${SHARE_TOKEN_PREFIX}${randomKeyBody(random)}`;
}

export function isShareToken(candidate: string): boolean {
  return SHARE_TOKEN_PATTERN.test(candidate);
}

export function isShareLinkOpen(link: ShareLink, now: Date): boolean {
  return link.expiresAt === null || now.getTime() < link.expiresAt.getTime();
}

export function requireShareLinkName(name: string): string {
  const trimmed = name.trim();
  if (trimmed === '' || trimmed.length > MAX_SHARE_LINK_NAME_LENGTH) {
    throw new InvalidShareLinkError(
      'name',
      `The name must have 1 to ${String(MAX_SHARE_LINK_NAME_LENGTH)} characters.`,
    );
  }
  return trimmed;
}

export function requireShareLinkExpiry(expiresAt: Date | null, now: Date): Date | null {
  if (expiresAt !== null && expiresAt.getTime() <= now.getTime()) {
    throw new InvalidShareLinkError('expires_at', 'A link can only expire after now.');
  }
  return expiresAt;
}
