import type { ShareLink, ShareLinkDraft } from '../share-links/share-link';
import type { UnlockFailures } from '../share-links/share-unlock';

export interface NewShareLink extends ShareLinkDraft {
  readonly projectId: string;
  readonly tokenHash: string;
  readonly passwordHash: string | null;
  readonly createdAt: Date;
}

export type ShareLinkCreation =
  { readonly outcome: 'created'; readonly link: ShareLink } | { readonly outcome: 'limit_reached' };

export interface ShareLinkRepository {
  create(link: NewShareLink, limit: number): Promise<ShareLinkCreation>;
  listByProject(projectId: string): Promise<readonly ShareLink[]>;
  findByTokenHash(tokenHash: string): Promise<ShareLink | null>;
  delete(projectId: string, linkId: string): Promise<boolean>;
  setPassword(
    projectId: string,
    linkId: string,
    passwordHash: string | null,
  ): Promise<ShareLink | null>;
  passwordHashOf(linkId: string): Promise<string | null>;
  unlockFailuresOf(linkId: string): Promise<UnlockFailures>;
  recordUnlockFailure(linkId: string, at: Date, windowMs: number): Promise<void>;
}

export const SHARE_LINK_REPOSITORY = Symbol('ShareLinkRepository');

export interface ShareUnlockRepository {
  issue(linkId: string, tokenHash: string, issuedAt: Date, expiresAt: Date): Promise<void>;
  isLive(linkId: string, tokenHash: string, now: Date): Promise<boolean>;
}

export const SHARE_UNLOCK_REPOSITORY = Symbol('ShareUnlockRepository');
