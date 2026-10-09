import { Logger } from '@nestjs/common';
import type { AdminUser } from '../../domain/entities/admin-user.entity';
import type { Project } from '../../domain/entities/project.entity';
import { ProjectNotFoundError } from '../../domain/errors/project.errors';
import { InMemoryEmailPreferencesRepository } from '../../test-utils/in-memory-email-preferences.repository';
import { GetEmailPreferencesUseCase } from './get-email-preferences.usecase';
import { SetEmailPreferencesUseCase } from './set-email-preferences.usecase';

const ADMIN: AdminUser = {
  id: '00000000-0000-4000-a000-000000000001',
  email: 'ana@example.com',
  emailLanguage: 'en',
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
};
const SHOP: Project = {
  id: '00000000-0000-4000-b000-000000000001',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'America/Sao_Paulo',
  conversionEvent: null,
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
};
const BLOG: Project = { ...SHOP, id: '00000000-0000-4000-b000-000000000002', name: 'Blog' };

function setup() {
  const preferences = new InMemoryEmailPreferencesRepository();
  preferences.grant(ADMIN.id, SHOP.id);
  return {
    get: new GetEmailPreferencesUseCase(preferences),
    set: new SetEmailPreferencesUseCase(preferences),
  };
}

describe('e-mail preferences', () => {
  let logs: unknown[];

  beforeEach(() => {
    logs = [];
    jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      logs.push(message);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends the weekly digest to an admin who never chose', async () => {
    const { get } = setup();

    expect(await get.execute(ADMIN, SHOP)).toEqual({ weeklyDigest: true });
  });

  it('turns the weekly digest off for one project and logs it without the e-mail', async () => {
    const { get, set } = setup();

    expect(await set.execute(ADMIN, SHOP, { weeklyDigest: false })).toEqual({
      weeklyDigest: false,
    });

    expect(await get.execute(ADMIN, SHOP)).toEqual({ weeklyDigest: false });
    expect(logs).toEqual([
      {
        message: 'email_preferences.updated',
        adminUserId: ADMIN.id,
        projectId: SHOP.id,
        weeklyDigest: false,
      },
    ]);
    expect(JSON.stringify(logs)).not.toContain(ADMIN.email);
  });

  it('answers project not found when the access is gone', async () => {
    const { get, set } = setup();

    await expect(get.execute(ADMIN, BLOG)).rejects.toBeInstanceOf(ProjectNotFoundError);
    await expect(set.execute(ADMIN, BLOG, { weeklyDigest: false })).rejects.toBeInstanceOf(
      ProjectNotFoundError,
    );
    expect(logs).toEqual([]);
  });
});
