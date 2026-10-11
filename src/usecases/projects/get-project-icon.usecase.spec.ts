import { ProjectIconNotFoundError } from '../../domain/errors/project.errors';
import type { ProjectIcon } from '../../domain/repositories/project-icon.repository';
import { InMemoryProjectIconRepository } from '../../test-utils/in-memory-project-icon.repository';
import { GetProjectIconUseCase } from './get-project-icon.usecase';

const SHOP = { projectId: 'shop-id', origin: 'https://shop.example.com' };
const BLOG = { projectId: 'blog-id', origin: 'https://blog.example.com' };

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

describe('GetProjectIconUseCase', () => {
  it('answers the stored icon of the project', async () => {
    const icons = new InMemoryProjectIconRepository();
    await icons.save(storedIcon(SHOP.projectId));

    await expect(new GetProjectIconUseCase(icons).execute(SHOP.projectId)).resolves.toEqual(
      storedIcon(SHOP.projectId),
    );
  });

  it('refuses a project without an icon', async () => {
    await expect(
      new GetProjectIconUseCase(new InMemoryProjectIconRepository()).execute(SHOP.projectId),
    ).rejects.toBeInstanceOf(ProjectIconNotFoundError);
  });
});

describe('InMemoryProjectIconRepository', () => {
  it('tells the versions of the projects that have an icon', async () => {
    const icons = new InMemoryProjectIconRepository();
    await icons.save(storedIcon(SHOP.projectId, 'v1v1v1v1v1v1v1v1'));

    await expect(icons.versionsOf([SHOP.projectId, BLOG.projectId])).resolves.toEqual(
      new Map([[SHOP.projectId, 'v1v1v1v1v1v1v1v1']]),
    );
  });
});
