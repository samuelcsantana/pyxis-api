import type { Project } from '../../domain/entities/project.entity';
import { InMemoryAdminUserRepository } from '../../test-utils/in-memory-admin-user.repository';
import { StubProjectActivityQuery } from '../../test-utils/stub-project-activity.query';
import { DescribeAdminUseCase } from './describe-admin.usecase';

function project(id: string, name: string): Project {
  return {
    id,
    name,
    allowedOrigins: ['https://shop.example.com'],
    timezone: 'America/Sao_Paulo',
    conversionEvent: null,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
  };
}

const SHOP = project('11111111-0000-4000-8000-000000000001', 'Shop');
const BLOG = project('11111111-0000-4000-8000-000000000002', 'Blog');

describe('DescribeAdminUseCase', () => {
  it('tells, for each project, when its first and its latest event happened', async () => {
    const admins = new InMemoryAdminUserRepository();
    admins.addProject(SHOP);
    admins.addProject(BLOG);
    const admin = await admins.grantAccess('owner@shop.example.com', SHOP.id);
    await admins.grantAccess('owner@shop.example.com', BLOG.id);
    const activity = new StubProjectActivityQuery();
    const firstEventAt = new Date('2026-10-01T12:00:00.000Z');
    const lastEventAt = new Date('2026-10-05T09:30:00.000Z');
    activity.activity.set(SHOP.id, { firstEventAt, lastEventAt });

    const description = await new DescribeAdminUseCase(admins, activity).execute(admin);

    expect(activity.asked).toEqual([[SHOP.id, BLOG.id]]);
    expect(description).toEqual({
      email: 'owner@shop.example.com',
      projects: [
        { ...SHOP, firstEventAt, lastEventAt },
        { ...BLOG, firstEventAt: null, lastEventAt: null },
      ],
    });
  });
});
