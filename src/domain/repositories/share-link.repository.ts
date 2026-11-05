import type { ShareLink, ShareLinkDraft } from '../share-links/share-link';

export interface NewShareLink extends ShareLinkDraft {
  readonly projectId: string;
  readonly tokenHash: string;
  readonly createdAt: Date;
}

export type ShareLinkCreation =
  { readonly outcome: 'created'; readonly link: ShareLink } | { readonly outcome: 'limit_reached' };

export interface ShareLinkRepository {
  create(link: NewShareLink, limit: number): Promise<ShareLinkCreation>;
  listByProject(projectId: string): Promise<readonly ShareLink[]>;
  findByTokenHash(tokenHash: string): Promise<ShareLink | null>;
  delete(projectId: string, linkId: string): Promise<boolean>;
}

export const SHARE_LINK_REPOSITORY = Symbol('ShareLinkRepository');
