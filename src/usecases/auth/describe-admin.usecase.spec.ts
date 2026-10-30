import type { Project } from '../../domain/entities/project.entity';
import { InMemoryAdminUserRepository } from '../../test-utils/in-memory-admin-user.repository';
import { InMemoryProjectIconRepository } from '../../test-utils/in-memory-project-icon.repository';
import { InMemoryProjectSuspensionRepository } from '../../test-utils/in-memory-project-suspension.repository';
import { StubProjectAccountsQuery } from '../../test-utils/stub-project-accounts.query';
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
const SHOP_ACCOUNT = '22222222-0000-4000-8000-000000000001';

describe('DescribeAdminUseCase', () => {
  it('tells, for each project, its first and latest events, its icon, its account and any suspension', async () => {
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
    const accounts = new StubProjectAccountsQuery();
    accounts.accounts.set(SHOP.id, SHOP_ACCOUNT);
    accounts.accounts.set(BLOG.id, null);

    const description = await new DescribeAdminUseCase(
      admins,
      activity,
      icons,
      restrictions,
      accounts,
    ).execute(admin);

    expect(activity.asked).toEqual([[SHOP.id, BLOG.id]]);
    expect(accounts.asked).toEqual([[SHOP.id, BLOG.id]]);
    expect(description).toEqual({
      email: 'owner@shop.example.com',
      projects: [
        {
          ...SHOP,
          firstEventAt,
          lastEventAt,
          iconVersion: null,
          accountId: SHOP_ACCOUNT,
          ingestionSuspendedAt: lastEventAt,
          ingestionSuspensionReason: 'Forged traffic.',
          deletionHeldAt: null,
        },
        {
          ...BLOG,
          firstEventAt: null,
          lastEventAt: null,
          iconVersion: '0123456789abcdef',
          accountId: null,
          ingestionSuspendedAt: null,
          ingestionSuspensionReason: null,
          deletionHeldAt: null,
        },
      ],
    });
  });
});
