import type { SiteIconType } from '../projects/site-icon';

export interface SiteIcon {
  readonly contentType: SiteIconType;
  readonly bytes: Uint8Array;
  readonly sourceUrl: string;
}

export type SiteIconOutcome =
  | { readonly kind: 'found'; readonly icon: SiteIcon }
  | { readonly kind: 'none' }
  | { readonly kind: 'unreachable'; readonly reason: string };

export interface SiteIconFetcher {
  fetchIcon(origin: string): Promise<SiteIconOutcome>;
}
