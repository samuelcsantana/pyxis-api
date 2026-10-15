import type { FastifyRequest } from 'fastify';
import type { AdminUser } from '../../../domain/entities/admin-user.entity';
import type { Project } from '../../../domain/entities/project.entity';
import type {
  AddProjectPersonCommand,
  AddProjectPersonUseCase,
} from '../../../usecases/people/add-project-person.usecase';
import type {
  ListProjectPeopleUseCase,
  PersonOfProject,
} from '../../../usecases/people/list-project-people.usecase';
import type {
  RemoveProjectPersonCommand,
  RemoveProjectPersonUseCase,
} from '../../../usecases/people/remove-project-person.usecase';
import { PeopleController, personBody } from './people.controller';

const ADMIN: AdminUser = {
  id: '00000000-0000-4000-a000-000000000001',
  email: 'owner@example.com',
  emailLanguage: 'en',
  suspendedAt: null,
  createdAt: new Date('2026-11-01T00:00:00.000Z'),
};
const PROJECT: Project = {
  id: '00000000-0000-4000-b000-000000000001',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'UTC',
  conversionEvent: null,
  createdAt: new Date('2026-11-01T00:00:00.000Z'),
};
const GUEST: PersonOfProject = {
  adminUserId: '00000000-0000-4000-a000-000000000002',
  email: 'guest@example.com',
  role: 'member',
  addedAt: new Date('2026-11-02T10:00:00.000Z'),
};

function peopleController() {
  const listed: string[] = [];
  const added: AddProjectPersonCommand[] = [];
  const removed: RemoveProjectPersonCommand[] = [];
  const controller = new PeopleController(
    {
      execute: (projectId: string) => {
        listed.push(projectId);
        return Promise.resolve([GUEST]);
      },
    } as unknown as ListProjectPeopleUseCase,
    {
      execute: (command: AddProjectPersonCommand) => {
        added.push(command);
        return Promise.resolve({ person: GUEST, added: true });
      },
    } as unknown as AddProjectPersonUseCase,
    {
      execute: (command: RemoveProjectPersonCommand) => {
        removed.push(command);
        return Promise.resolve();
      },
    } as unknown as RemoveProjectPersonUseCase,
  );
  return { controller, listed, added, removed };
}

const request = { admin: ADMIN, project: PROJECT } as unknown as FastifyRequest;

describe('personBody', () => {
  it('writes a person in the API shape', () => {
    expect(personBody(GUEST)).toEqual({
      admin_user_id: GUEST.adminUserId,
      email: 'guest@example.com',
      role: 'member',
      added_at: '2026-11-02T10:00:00.000Z',
    });
  });
});

describe('PeopleController', () => {
  it('lists the people of the project the guard found', async () => {
    const { controller, listed } = peopleController();

    const body = await controller.people(request);

    expect(listed).toEqual([PROJECT.id]);
    expect(body.people.map(({ email }) => email)).toEqual(['guest@example.com']);
  });

  it('adds a person in the name of the signed-in owner, in the language of the page', async () => {
    const { controller, added } = peopleController();

    const body = await controller.add(request, PROJECT.id, {
      email: 'guest@example.com',
      locale: 'es-MX',
    });
    await controller.add(request, PROJECT.id, { email: 'guest@example.com' });

    expect(body.added).toBe(true);
    expect(added).toEqual([
      {
        adminUserId: ADMIN.id,
        inviterEmail: ADMIN.email,
        projectId: PROJECT.id,
        email: 'guest@example.com',
        language: 'es',
      },
      expect.objectContaining({ language: 'en' }),
    ]);
  });

  it('removes a person in the name of the signed-in owner', async () => {
    const { controller, removed } = peopleController();

    await controller.remove(request, PROJECT.id, GUEST.adminUserId);

    expect(removed).toEqual([
      { adminUserId: ADMIN.id, projectId: PROJECT.id, personId: GUEST.adminUserId },
    ]);
  });
});
