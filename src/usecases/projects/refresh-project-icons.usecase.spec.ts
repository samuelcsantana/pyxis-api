import { iconVersion } from '../../domain/projects/site-icon';
import type { ProjectIcon } from '../../domain/repositories/project-icon.repository';
import { FixedClock } from '../../test-utils/fixed-clock';
import { InMemoryProjectIconRepository } from '../../test-utils/in-memory-project-icon.repository';
import { StubSiteIconFetcher } from '../../test-utils/stub-site-icon-fetcher';
import { RefreshProjectIconsUseCase } from './refresh-project-icons.usecase';

const SHOP = { projectId: 'shop-id', origin: 'https://shop.example.com' };
const BLOG = { projectId: 'blog-id', origin: 'https://blog.example.com' };
const DOCS = { projectId: 'docs-id', origin: 'https://docs.example.com' };
const NOW = new Date('2026-10-11T06:00:00.000Z');
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9]);

function storedIcon(projectId: string, version = 'old0old0old0old0'): ProjectIcon {
  return {
    projectId,
    contentType: 'image/x-icon',
    bytes: Uint8Array.from([0, 0, 1, 0]),
    version,
    sourceUrl: 'https://example.com/favicon.ico',
    fetchedAt: new Date('2026-10-10T06:00:00.000Z'),
  };
}

describe('RefreshProjectIconsUseCase', () => {
  it('stores the icon found, with a version from its bytes and the time it was fetched', async () => {
    const icons = new InMemoryProjectIconRepository([SHOP]);
    const fetcher = new StubSiteIconFetcher({
      [SHOP.origin]: {
        kind: 'found',
        icon: { contentType: 'image/png', bytes: PNG, sourceUrl: `${SHOP.origin}/icon.png` },
      },
    });

    const report = await new RefreshProjectIconsUseCase(
      icons,
      fetcher,
      new FixedClock(NOW),
    ).execute();

    expect(report).toEqual({ found: 1, removed: 0, unreachable: 0 });
    expect(icons.stored).toEqual([
      {
        projectId: SHOP.projectId,
        contentType: 'image/png',
        bytes: PNG,
        version: iconVersion(PNG),
        sourceUrl: `${SHOP.origin}/icon.png`,
        fetchedAt: NOW,
      },
    ]);
  });

  it('removes the stored icon when the site answers without one', async () => {
    const icons = new InMemoryProjectIconRepository([BLOG]);
    await icons.save(storedIcon(BLOG.projectId));

    const report = await new RefreshProjectIconsUseCase(
      icons,
      new StubSiteIconFetcher({}),
      new FixedClock(NOW),
    ).execute();

    expect(report).toEqual({ found: 0, removed: 1, unreachable: 0 });
    expect(icons.stored).toEqual([]);
  });

  it('keeps the stored icon when the site cannot be reached, or the fetch throws', async () => {
    const icons = new InMemoryProjectIconRepository([SHOP, DOCS]);
    await icons.save(storedIcon(SHOP.projectId));
    await icons.save(storedIcon(DOCS.projectId));
    const fetcher = new StubSiteIconFetcher({
      [SHOP.origin]: { kind: 'unreachable', reason: 'fetch failed' },
      [DOCS.origin]: new Error('resolver crashed'),
    });

    const report = await new RefreshProjectIconsUseCase(
      icons,
      fetcher,
      new FixedClock(NOW),
    ).execute();

    expect(report).toEqual({ found: 0, removed: 0, unreachable: 2 });
    expect(icons.stored.map((icon) => icon.projectId)).toEqual([SHOP.projectId, DOCS.projectId]);
  });

  it('counts a thrown value that is not an Error as unreachable too', async () => {
    const icons = new InMemoryProjectIconRepository([SHOP]);
    const fetcher = new StubSiteIconFetcher({});
    jest.spyOn(fetcher, 'fetchIcon').mockRejectedValue('timeout');

    const report = await new RefreshProjectIconsUseCase(
      icons,
      fetcher,
      new FixedClock(NOW),
    ).execute();

    expect(report).toEqual({ found: 0, removed: 0, unreachable: 1 });
  });

  it('asks each site once, one after the other, and does nothing without sites', async () => {
    const fetcher = new StubSiteIconFetcher({});

    await new RefreshProjectIconsUseCase(
      new InMemoryProjectIconRepository([SHOP, BLOG]),
      fetcher,
      new FixedClock(NOW),
    ).execute();
    const empty = await new RefreshProjectIconsUseCase(
      new InMemoryProjectIconRepository(),
      fetcher,
      new FixedClock(NOW),
    ).execute();

    expect(fetcher.asked).toEqual([SHOP.origin, BLOG.origin]);
    expect(empty).toEqual({ found: 0, removed: 0, unreachable: 0 });
  });
});
