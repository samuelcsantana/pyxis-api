import { Logger } from '@nestjs/common';
import { InMemoryFreeSiteSharingRepository } from '../../test-utils/in-memory-free-site-sharing.repository';
import { ReportSharedFreeSitesUseCase } from './report-shared-free-sites.usecase';

const FREE_ACCOUNT = 'acc00000-0000-4000-a000-000000000001';
const SECOND_FREE_ACCOUNT = 'acc00000-0000-4000-a000-000000000002';
const SHOP = 'prj00000-0000-4000-a000-000000000001';
const BLOG = 'prj00000-0000-4000-a000-000000000002';
const COPY = 'prj00000-0000-4000-a000-000000000003';
const OTHER_SHOP = 'prj00000-0000-4000-a000-000000000011';

describe('ReportSharedFreeSitesUseCase', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('warns once per shared project, with ids only, and counts the free accounts involved', async () => {
    const sharing = new InMemoryFreeSiteSharingRepository();
    sharing.overlap(
      {
        accountId: FREE_ACCOUNT,
        projectId: SHOP,
        origin: 'https://shop.example.com',
        otherProjectId: OTHER_SHOP,
      },
      {
        accountId: FREE_ACCOUNT,
        projectId: BLOG,
        origin: 'https://blog.example.com',
        otherProjectId: OTHER_SHOP,
      },
      {
        accountId: SECOND_FREE_ACCOUNT,
        projectId: COPY,
        origin: 'https://shop.example.com',
        otherProjectId: SHOP,
      },
    );

    await expect(new ReportSharedFreeSitesUseCase(sharing).execute()).resolves.toBe(2);

    expect(warn.mock.calls).toEqual([
      [
        {
          message: 'accounts.free_site_shared',
          accountId: FREE_ACCOUNT,
          projectId: SHOP,
          otherProjectIds: [OTHER_SHOP],
        },
      ],
      [
        {
          message: 'accounts.free_site_shared',
          accountId: FREE_ACCOUNT,
          projectId: BLOG,
          otherProjectIds: [OTHER_SHOP],
        },
      ],
      [
        {
          message: 'accounts.free_site_shared',
          accountId: SECOND_FREE_ACCOUNT,
          projectId: COPY,
          otherProjectIds: [SHOP],
        },
      ],
    ]);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('example.com');
  });

  it('warns nothing and counts none when no free account shares a site', async () => {
    await expect(
      new ReportSharedFreeSitesUseCase(new InMemoryFreeSiteSharingRepository()).execute(),
    ).resolves.toBe(0);

    expect(warn).not.toHaveBeenCalled();
  });
});
