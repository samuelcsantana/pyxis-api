import type { SiteIconFetcher, SiteIconOutcome } from '../domain/services/site-icon-fetcher';

export class StubSiteIconFetcher implements SiteIconFetcher {
  readonly asked: string[] = [];

  constructor(private readonly outcomes: Readonly<Record<string, SiteIconOutcome | Error>>) {}

  fetchIcon(origin: string): Promise<SiteIconOutcome> {
    this.asked.push(origin);
    const outcome = this.outcomes[origin] ?? { kind: 'none' };
    return outcome instanceof Error ? Promise.reject(outcome) : Promise.resolve(outcome);
  }
}
