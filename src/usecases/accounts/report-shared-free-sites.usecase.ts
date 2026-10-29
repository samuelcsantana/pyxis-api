import { Logger } from '@nestjs/common';
import { sharedFreeSitesOf } from '../../domain/accounts/shared-free-site';
import type { FreeSiteSharingRepository } from '../../domain/repositories/free-site-sharing.repository';

export class ReportSharedFreeSitesUseCase {
  private readonly logger = new Logger(ReportSharedFreeSitesUseCase.name);

  constructor(private readonly sharing: FreeSiteSharingRepository) {}

  async execute(): Promise<number> {
    const shared = sharedFreeSitesOf(await this.sharing.siteOverlapsOfFreeAccounts());
    for (const site of shared) {
      this.logger.warn({
        message: 'accounts.free_site_shared',
        accountId: site.accountId,
        projectId: site.projectId,
        otherProjectIds: site.otherProjectIds,
      });
    }
    return new Set(shared.map((site) => site.accountId)).size;
  }
}
