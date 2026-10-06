import type { Project } from '../../domain/entities/project.entity';
import { ProjectNotFoundError } from '../../domain/errors/project.errors';
import { InMemoryAdminUserRepository } from '../../test-utils/in-memory-admin-user.repository';
import { InMemoryProjectRepository } from '../../test-utils/in-memory-project.repository';
import { GrantAdminAccessUseCase } from './grant-admin-access.usecase';

const PROJECT: Project = {
  id: '9f1c2b3a-1d2e-4f5a-8b6c-7d8e9f0a1b2c',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'UTC',
  conversionEvent: null,
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
};

function setup() {
  const projects = new InMemoryProjectRepository();
  projects.add(PROJECT);
  const admins = new InMemoryAdminUserRepository();
  admins.addProject(PROJECT);
  return { admins, grant: new GrantAdminAccessUseCase(projects, admins) };
}

describe('GrantAdminAccessUseCase', () => {
  it('creates the admin under the normalized email and lets them read the project', async () => {
    const { admins, grant } = setup();

    const granted = await grant.execute({ email: ' Ana@Example.com ', projectId: PROJECT.id });

    expect(granted).toEqual({
      adminUserId: expect.any(String) as string,
      email: 'ana@example.com',
      projectId: PROJECT.id,
    });
    expect(await admins.projectsOf(granted.adminUserId)).toEqual([PROJECT]);
  });

  it('reuses the admin and keeps a single grant when run twice', async () => {
    const { admins, grant } = setup();

    const first = await grant.execute({ email: 'ana@example.com', projectId: PROJECT.id });
    const second = await grant.execute({ email: 'ANA@example.com', projectId: PROJECT.id });

    expect(second.adminUserId).toBe(first.adminUserId);
    expect(await admins.projectsOf(first.adminUserId)).toEqual([PROJECT]);
  });

  it('refuses a project that does not exist and creates no admin', async () => {
    const { admins, grant } = setup();

    await expect(
      grant.execute({
        email: 'ana@example.com',
        projectId: '00000000-0000-4000-8000-000000000000',
      }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
    expect(await admins.findByEmail('ana@example.com')).toBeNull();
  });
});
