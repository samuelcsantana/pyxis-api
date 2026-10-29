import type { SiteOverlap } from '../accounts/shared-free-site';

export interface FreeSiteSharingRepository {
  siteOverlapsOfFreeAccounts(): Promise<readonly SiteOverlap[]>;
}
