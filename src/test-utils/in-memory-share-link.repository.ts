import type {
  NewShareLink,
  ShareLinkCreation,
  ShareLinkRepository,
} from '../domain/repositories/share-link.repository';
import type { ShareLink } from '../domain/share-links/share-link';

const ID_DIGITS = 12;

export function shareLinkIdOf(sequence: number): string {
  return `00000000-0000-4000-9000-${String(sequence).padStart(ID_DIGITS, '0')}`;
}

interface StoredShareLink {
  readonly link: ShareLink;
  readonly tokenHash: string;
}

export class InMemoryShareLinkRepository implements ShareLinkRepository {
  private links: readonly StoredShareLink[] = [];
  private sequence = 0;

  get stored(): readonly ShareLink[] {
    return this.links.map(({ link }) => link);
  }

  get tokenHashes(): readonly string[] {
    return this.links.map(({ tokenHash }) => tokenHash);
  }

  async create(link: NewShareLink, limit: number): Promise<ShareLinkCreation> {
    const held = await this.listByProject(link.projectId);
    if (held.length >= limit) {
      return { outcome: 'limit_reached' };
    }
    this.sequence += 1;
    const created: ShareLink = {
      id: shareLinkIdOf(this.sequence),
      projectId: link.projectId,
      name: link.name,
      createdAt: link.createdAt,
      expiresAt: link.expiresAt,
    };
    this.links = [...this.links, { link: created, tokenHash: link.tokenHash }];
    return { outcome: 'created', link: created };
  }

  listByProject(projectId: string): Promise<readonly ShareLink[]> {
    return Promise.resolve(this.stored.filter((link) => link.projectId === projectId));
  }

  findByTokenHash(tokenHash: string): Promise<ShareLink | null> {
    return Promise.resolve(
      this.links.find((stored) => stored.tokenHash === tokenHash)?.link ?? null,
    );
  }

  delete(projectId: string, linkId: string): Promise<boolean> {
    const before = this.links.length;
    this.links = this.links.filter(
      ({ link }) => !(link.id === linkId && link.projectId === projectId),
    );
    return Promise.resolve(this.links.length < before);
  }
}
