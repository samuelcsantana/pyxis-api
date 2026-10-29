const LOCAL_HOSTNAMES: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]']);
const LOCAL_HOSTNAME_SUFFIX = '.localhost';

export interface SiteOverlap {
  readonly accountId: string;
  readonly projectId: string;
  readonly origin: string;
  readonly otherProjectId: string;
}

export interface SharedFreeSite {
  readonly accountId: string;
  readonly projectId: string;
  readonly otherProjectIds: readonly string[];
}

export function isLocalDevelopmentOrigin(origin: string): boolean {
  const { hostname } = new URL(origin);
  return LOCAL_HOSTNAMES.has(hostname) || hostname.endsWith(LOCAL_HOSTNAME_SUFFIX);
}

export function sharedFreeSitesOf(overlaps: readonly SiteOverlap[]): readonly SharedFreeSite[] {
  const byProject = new Map<string, { accountId: string; otherProjectIds: Set<string> }>();
  for (const overlap of overlaps) {
    if (isLocalDevelopmentOrigin(overlap.origin)) {
      continue;
    }
    const shared = byProject.get(overlap.projectId) ?? {
      accountId: overlap.accountId,
      otherProjectIds: new Set<string>(),
    };
    shared.otherProjectIds.add(overlap.otherProjectId);
    byProject.set(overlap.projectId, shared);
  }
  return [...byProject.entries()]
    .map(([projectId, shared]) => ({
      accountId: shared.accountId,
      projectId,
      otherProjectIds: [...shared.otherProjectIds].sort(),
    }))
    .sort((first, second) => first.projectId.localeCompare(second.projectId));
}
