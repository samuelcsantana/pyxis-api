import type {
  NewShareLink,
  ShareLinkCreation,
  ShareLinkRepository,
  ShareUnlockRepository,
} from '../domain/repositories/share-link.repository';
import type { ShareLink } from '../domain/share-links/share-link';
import type { UnlockFailures } from '../domain/share-links/share-unlock';

const ID_DIGITS = 12;
const NO_FAILURES: UnlockFailures = { count: 0, since: null };

export function shareLinkIdOf(sequence: number): string {
  return `00000000-0000-4000-9000-${String(sequence).padStart(ID_DIGITS, '0')}`;
}

interface StoredShareLink {
  readonly link: ShareLink;
  readonly tokenHash: string;
  readonly passwordHash: string | null;
  readonly failures: UnlockFailures;
}

interface StoredUnlock {
  readonly linkId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
}

export class InMemoryShareUnlockRepository implements ShareUnlockRepository {
  private unlocks: readonly StoredUnlock[] = [];

  get stored(): readonly StoredUnlock[] {
    return this.unlocks;
  }

  forgetLink(linkId: string): void {
    this.unlocks = this.unlocks.filter((unlock) => unlock.linkId !== linkId);
  }

  issue(linkId: string, tokenHash: string, issuedAt: Date, expiresAt: Date): Promise<void> {
    this.unlocks = [
      ...this.unlocks.filter(
        (unlock) => unlock.linkId !== linkId || unlock.expiresAt.getTime() > issuedAt.getTime(),
      ),
      { linkId, tokenHash, expiresAt },
    ];
    return Promise.resolve();
  }

  isLive(linkId: string, tokenHash: string, now: Date): Promise<boolean> {
    return Promise.resolve(
      this.unlocks.some(
        (unlock) =>
          unlock.linkId === linkId &&
          unlock.tokenHash === tokenHash &&
          unlock.expiresAt.getTime() > now.getTime(),
      ),
    );
  }
}

export class InMemoryShareLinkRepository implements ShareLinkRepository {
  private links: readonly StoredShareLink[] = [];
  private sequence = 0;

  constructor(private readonly unlocks = new InMemoryShareUnlockRepository()) {}

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
      passwordProtected: link.passwordHash !== null,
    };
    this.links = [
      ...this.links,
      {
        link: created,
        tokenHash: link.tokenHash,
        passwordHash: link.passwordHash,
        failures: NO_FAILURES,
      },
    ];
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
    this.unlocks.forgetLink(linkId);
    return Promise.resolve(this.links.length < before);
  }

  setPassword(
    projectId: string,
    linkId: string,
    passwordHash: string | null,
  ): Promise<ShareLink | null> {
    const found = this.links.find(({ link }) => link.id === linkId && link.projectId === projectId);
    if (found === undefined) {
      return Promise.resolve(null);
    }
    const changed: StoredShareLink = {
      ...found,
      link: { ...found.link, passwordProtected: passwordHash !== null },
      passwordHash,
      failures: NO_FAILURES,
    };
    this.links = this.links.map((stored) => (stored === found ? changed : stored));
    this.unlocks.forgetLink(linkId);
    return Promise.resolve(changed.link);
  }

  passwordHashOf(linkId: string): Promise<string | null> {
    return Promise.resolve(this.byId(linkId)?.passwordHash ?? null);
  }

  unlockFailuresOf(linkId: string): Promise<UnlockFailures> {
    return Promise.resolve(this.byId(linkId)?.failures ?? NO_FAILURES);
  }

  recordUnlockFailure(linkId: string, at: Date, windowMs: number): Promise<void> {
    this.links = this.links.map((stored) => {
      if (stored.link.id !== linkId) {
        return stored;
      }
      const { since, count } = stored.failures;
      const stale = since === null || since.getTime() <= at.getTime() - windowMs;
      return { ...stored, failures: stale ? { count: 1, since: at } : { count: count + 1, since } };
    });
    return Promise.resolve();
  }

  private byId(linkId: string): StoredShareLink | undefined {
    return this.links.find(({ link }) => link.id === linkId);
  }
}
