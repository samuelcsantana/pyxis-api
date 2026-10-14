import type { FastifyRequest } from 'fastify';
import type { AdminUser } from '../../../domain/entities/admin-user.entity';
import type { Project } from '../../../domain/entities/project.entity';
import type {
  CreateOwnedProjectKeyCommand,
  CreateOwnedProjectKeyUseCase,
} from '../../../usecases/projects/create-owned-project-key.usecase';
import type {
  CreateOwnedProjectCommand,
  CreateOwnedProjectUseCase,
} from '../../../usecases/projects/create-owned-project.usecase';
import type {
  DeleteOwnedProjectCommand,
  DeleteOwnedProjectUseCase,
} from '../../../usecases/projects/delete-owned-project.usecase';
import type {
  RevokeOwnedProjectKeyCommand,
  RevokeOwnedProjectKeyUseCase,
} from '../../../usecases/projects/revoke-owned-project-key.usecase';
import type {
  UpdateOwnedProjectCommand,
  UpdateOwnedProjectUseCase,
} from '../../../usecases/projects/update-owned-project.usecase';
import { managedProjectBody, ProjectsController } from './projects.controller';

const ADMIN: AdminUser = {
  id: '00000000-0000-4000-a000-000000000001',
  email: 'owner@example.com',
  emailLanguage: 'en',
  createdAt: new Date('2026-11-01T00:00:00.000Z'),
};
const ACCOUNT_ID = 'acc00000-0000-4000-a000-000000000001';
const PROJECT: Project = {
  id: '00000000-0000-4000-b000-000000000001',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'UTC',
  conversionEvent: null,
  createdAt: new Date('2026-11-02T00:00:00.000Z'),
};

type Command =
  | CreateOwnedProjectCommand
  | UpdateOwnedProjectCommand
  | DeleteOwnedProjectCommand
  | CreateOwnedProjectKeyCommand
  | RevokeOwnedProjectKeyCommand;

function projectsController() {
  const calls: { readonly useCase: string; readonly command: Command }[] = [];
  const record =
    <Result>(useCase: string, result: Result) =>
    (command: Command) => {
      calls.push({ useCase, command });
      return Promise.resolve(result);
    };
  const controller = new ProjectsController(
    {
      execute: record('create', {
        projectId: PROJECT.id,
        publicKeyId: 'key-1',
        publicKey: 'pyxis_pk_x',
      }),
    } as unknown as CreateOwnedProjectUseCase,
    { execute: record('update', PROJECT) } as unknown as UpdateOwnedProjectUseCase,
    {
      execute: record('delete', { project: PROJECT, deletedEvents: 120, deletedKeys: 2 }),
    } as unknown as DeleteOwnedProjectUseCase,
    {
      execute: record('createKey', { keyId: 'key-2', kind: 'secret', key: 'pyxis_sk_y' }),
    } as unknown as CreateOwnedProjectKeyUseCase,
    { execute: record('revokeKey', undefined) } as unknown as RevokeOwnedProjectKeyUseCase,
  );
  return { controller, calls };
}

function signedIn(): FastifyRequest {
  return { admin: ADMIN } as unknown as FastifyRequest;
}

describe('managedProjectBody', () => {
  it('writes the settings of a project in the API shape', () => {
    expect(managedProjectBody(PROJECT)).toEqual({
      id: PROJECT.id,
      name: 'Shop',
      allowed_origins: ['https://shop.example.com'],
      timezone: 'UTC',
      conversion_event: null,
      created_at: '2026-11-02T00:00:00.000Z',
    });
  });
});

describe('ProjectsController', () => {
  it('creates a project with the settings given, and answers its public key', async () => {
    const { controller, calls } = projectsController();

    const body = await controller.create(signedIn(), ACCOUNT_ID, {
      name: 'Shop',
      allowed_origins: ['https://shop.example.com'],
      timezone: 'America/Sao_Paulo',
      conversion_event: 'signup_completed',
    });

    expect(body).toEqual({
      project_id: PROJECT.id,
      public_key: { id: 'key-1', key: 'pyxis_pk_x' },
    });
    expect(calls).toEqual([
      {
        useCase: 'create',
        command: {
          adminUserId: ADMIN.id,
          accountId: ACCOUNT_ID,
          name: 'Shop',
          allowedOrigins: ['https://shop.example.com'],
          timezone: 'America/Sao_Paulo',
          conversionEvent: 'signup_completed',
        },
      },
    ]);
  });

  it('leaves out the optional settings that were not given', async () => {
    const { controller, calls } = projectsController();

    await controller.create(signedIn(), ACCOUNT_ID, {
      name: 'Shop',
      allowed_origins: ['https://shop.example.com'],
    });
    await controller.update(signedIn(), PROJECT.id, {});

    expect(calls.map(({ command }) => command)).toEqual([
      {
        adminUserId: ADMIN.id,
        accountId: ACCOUNT_ID,
        name: 'Shop',
        allowedOrigins: ['https://shop.example.com'],
      },
      { adminUserId: ADMIN.id, projectId: PROJECT.id },
    ]);
  });

  it('passes every change given, a cleared conversion event included', async () => {
    const { controller, calls } = projectsController();

    const body = await controller.update(signedIn(), PROJECT.id, {
      name: 'Store',
      allowed_origins: ['https://store.example.com'],
      timezone: 'UTC',
      conversion_event: null,
    });

    expect(body.id).toBe(PROJECT.id);
    expect(calls[0]?.command).toEqual({
      adminUserId: ADMIN.id,
      projectId: PROJECT.id,
      name: 'Store',
      allowedOrigins: ['https://store.example.com'],
      timezone: 'UTC',
      conversionEvent: null,
    });
  });

  it('deletes with the name typed again, and tells what went', async () => {
    const { controller, calls } = projectsController();

    const body = await controller.remove(signedIn(), PROJECT.id, { confirm_name: 'Shop' });

    expect(body).toEqual({ project_id: PROJECT.id, deleted_events: 120, deleted_keys: 2 });
    expect(calls[0]?.command).toEqual({
      adminUserId: ADMIN.id,
      projectId: PROJECT.id,
      confirmName: 'Shop',
    });
  });

  it('creates and revokes keys of the project', async () => {
    const { controller, calls } = projectsController();

    const created = await controller.createKey(signedIn(), PROJECT.id, { kind: 'secret' });
    await controller.revokeKey(signedIn(), PROJECT.id, 'key-2');

    expect(created).toEqual({ id: 'key-2', kind: 'secret', key: 'pyxis_sk_y' });
    expect(calls.map(({ command }) => command)).toEqual([
      { adminUserId: ADMIN.id, projectId: PROJECT.id, kind: 'secret' },
      { adminUserId: ADMIN.id, projectId: PROJECT.id, keyId: 'key-2' },
    ]);
  });
});
