import { Logger } from '@nestjs/common';
import { iconVersion } from '../../domain/projects/site-icon';
import type {
  ProjectIconRepository,
  ProjectSite,
} from '../../domain/repositories/project-icon.repository';
import type { Clock } from '../../domain/services/clock';
import type { SiteIconFetcher, SiteIconOutcome } from '../../domain/services/site-icon-fetcher';

export interface ProjectIconsReport {
  readonly found: number;
  readonly removed: number;
  readonly unreachable: number;
}

type OutcomeKind = SiteIconOutcome['kind'];

const COUNTERS: Readonly<Record<OutcomeKind, keyof ProjectIconsReport>> = {
  found: 'found',
  none: 'removed',
  unreachable: 'unreachable',
};

export class RefreshProjectIconsUseCase {
  private readonly logger = new Logger(RefreshProjectIconsUseCase.name);

  constructor(
    private readonly icons: ProjectIconRepository,
    private readonly fetcher: SiteIconFetcher,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<ProjectIconsReport> {
    const report = { found: 0, removed: 0, unreachable: 0 };
    for (const site of await this.icons.sites()) {
      const outcome = await this.bestEffortFetch(site);
      await this.keep(site, outcome);
      report[COUNTERS[outcome.kind]] += 1;
      this.logger.log({
        message: 'project_icon.refreshed',
        projectId: site.projectId,
        outcome: outcome.kind,
      });
    }
    this.logger.log({ message: 'project_icons.completed', ...report });
    return report;
  }

  private async keep(site: ProjectSite, outcome: SiteIconOutcome): Promise<void> {
    if (outcome.kind === 'found') {
      await this.icons.save({
        projectId: site.projectId,
        contentType: outcome.icon.contentType,
        bytes: outcome.icon.bytes,
        version: iconVersion(outcome.icon.bytes),
        sourceUrl: outcome.icon.sourceUrl,
        fetchedAt: this.clock.now(),
      });
    } else if (outcome.kind === 'none') {
      await this.icons.remove(site.projectId);
    }
  }

  private async bestEffortFetch(site: ProjectSite): Promise<SiteIconOutcome> {
    try {
      return await this.fetcher.fetchIcon(site.origin);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn({ message: 'project_icon.fetch_failed', projectId: site.projectId, reason });
      return { kind: 'unreachable', reason };
    }
  }
}
