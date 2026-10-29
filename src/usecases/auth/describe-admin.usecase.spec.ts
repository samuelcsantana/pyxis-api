import type { Project } from '../../domain/entities/project.entity';
import { InMemoryAdminUserRepository } from '../../test-utils/in-memory-admin-user.repository';
import { InMemoryProjectIconRepository } from '../../test-utils/in-memory-project-icon.repository';
import { InMemoryProjectSuspensionRepository } from '../../test-utils/in-memory-project-suspension.repository';
import { StubProjectActivityQuery } from '../../test-utils/stub-project-activity.query';
import { DescribeAdminUseCase } from './describe-admin.usecase';

function project(id: string, name: string): Project {
  return {
    id,
    name,
    allowedOrigins: ['https://shop.example.com'],
    timezone: 'America/Sao_Paulo',
    conversionEvent: null,
    cityEnabled: false,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
  };
}

const SHOP = project('11111111-0000-4000-8000-000000000001', 'Shop');
const BLOG = project('11111111-0000-4000-8000-000000000002', 'Blog');

describe('DescribeAdminUseCase', () => {
  it('tells, for each project, its first and latest events, its icon and any suspension', async () => {
    const admins = new InMemoryAdminUserRepository();
    admins.addProject(SHOP);
    admins.addProject(BLOG);
    const admin = await admins.grantAccess('owner@shop.example.com', SHOP.id);
    await admins.grantAccess('owner@shop.example.com', BLOG.id);
    const activity = new StubProjectActivityQuery();
    const firstEventAt = new Date('2026-10-01T12:00:00.000Z');
    const lastEventAt = new Date('2026-10-05T09:30:00.000Z');
    activity.activity.set(SHOP.id, { firstEventAt, lastEventAt });
    const icons = new InMemoryProjectIconRepository();
    await icons.save({
      projectId: BLOG.id,
      contentType: 'image/png',
      bytes: Uint8Array.from([1]),
      version: '0123456789abcdef',
      sourceUrl: 'https://blog.example.com/icon.png',
      fetchedAt: lastEventAt,
    });

    const restrictions = new InMemoryProjectSuspensionRepository();
    restrictions.add(SHOP.id, SHOP.name, admin.id);
    await restrictions.suspend(SHOP.id, 'Forged traffic.', lastEventAt);

    const description = await new DescribeAdminUseCase(
      admins,
      activity,
      icons,
      restrictions,
    ).execute(admin);

    expect(activity.asked).toEqual([[SHOP.id, BLOG.id]]);
    expect(description).toEqual({
      email: 'owner@shop.example.com',
      projects: [
        {
          ...SHOP,
          firstEventAt,
          lastEventAt,
          iconVersion: null,
          ingestionSuspendedAt: lastEventAt,
          ingestionSuspensionReason: 'Forged traffic.',
          deletionHeldAt: null,
        },
        {
          ...BLOG,
          firstEventAt: null,
          lastEventAt: null,
          iconVersion: '0123456789abcdef',
          ingestionSuspendedAt: null,
          ingestionSuspensionReason: null,
          deletionHeldAt: null,
        },
      ],
    });
  });
});
