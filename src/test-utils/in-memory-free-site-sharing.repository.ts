import type { SiteOverlap } from '../domain/accounts/shared-free-site';
import type { FreeSiteSharingRepository } from '../domain/repositories/free-site-sharing.repository';

export class InMemoryFreeSiteSharingRepository implements FreeSiteSharingRepository {
  private overlaps: readonly SiteOverlap[] = [];

  overlap(...overlaps: readonly SiteOverlap[]): void {
    this.overlaps = [...this.overlaps, ...overlaps];
  }

  siteOverlapsOfFreeAccounts(): Promise<readonly SiteOverlap[]> {
    return Promise.resolve(this.overlaps);
  }
}
