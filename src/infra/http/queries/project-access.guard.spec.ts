import { type ExecutionContext, NotFoundException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { AdminUser } from '../../../domain/entities/admin-user.entity';
import type { Project } from '../../../domain/entities/project.entity';
import { AccountSuspendedError } from '../../../domain/errors/account.errors';
import { InMemoryAccountUsageRepository } from '../../../test-utils/in-memory-account-usage.repository';
import { InMemoryAdminUserRepository } from '../../../test-utils/in-memory-admin-user.repository';
import { ProjectAccessGuard, projectOf } from './project-access.guard';

const PROJECT: Project = {
  id: '6f1d3c2a-8b4e-4f7a-9c1d-2e3f4a5b6c7d',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'UTC',
  conversionEvent: null,
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
};

const ACCOUNT_ID = 'acc00000-0000-4000-a000-000000000001';

function contextOf(request: FastifyRequest): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
}

async function setup() {
  const admins = new InMemoryAdminUserRepository();
  admins.addProject(PROJECT);
  const admin = await admins.grantAccess('ana@example.com', PROJECT.id);
  const stranger = await admins.grantAccess('bruno@example.com', 'another-project');
  const request = (who: AdminUser, projectId: string | undefined) =>
    ({ admin: who, params: projectId === undefined ? {} : { projectId } }) as FastifyRequest;
  const accountStates = new InMemoryAccountUsageRepository();
  return {
    guard: new ProjectAccessGuard(admins, accountStates),
    accountStates,
    admin,
    stranger,
    request,
  };
}

describe('ProjectAccessGuard', () => {
  it('puts a project the admin may read on the request, whatever the case of its id', async () => {
    const { guard, admin, request } = await setup();
    const allowed = request(admin, PROJECT.id.toUpperCase());

    await expect(guard.canActivate(contextOf(allowed))).resolves.toBe(true);
    expect(projectOf(allowed)).toEqual(PROJECT);
  });

  it('refuses a project whose account is suspended, without putting it on the request', async () => {
    const { guard, accountStates, admin, request } = await setup();
    accountStates.placeProject(PROJECT.id, ACCOUNT_ID);
    accountStates.markSuspended(ACCOUNT_ID);
    const refused = request(admin, PROJECT.id);

    await expect(guard.canActivate(contextOf(refused))).rejects.toThrow(AccountSuspendedError);
    expect(refused.project).toBeUndefined();
  });

  it('answers not found for a project the admin was not granted', async () => {
    const { guard, stranger, request } = await setup();

    await expect(guard.canActivate(contextOf(request(stranger, PROJECT.id)))).rejects.toThrow(
      NotFoundException,
    );
  });

  it.each([
    ['an id that is not a UUID', 'shop'],
    ['no id at all', undefined],
  ])('answers not found for %s without asking the database', async (_case, projectId) => {
    const { guard, admin, request } = await setup();

    await expect(guard.canActivate(contextOf(request(admin, projectId)))).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('projectOf', () => {
  it('fails loudly when a route reads the project without the guard', () => {
    expect(() => projectOf({} as FastifyRequest)).toThrow('ProjectAccessGuard must run before');
  });
});
