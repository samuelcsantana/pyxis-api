import type { FastifyRequest } from 'fastify';
import type { AdminUser } from '../../../domain/entities/admin-user.entity';
import type { ProjectExport } from '../../../domain/exports/project-export';
import type {
  GetProjectExportCommand,
  GetProjectExportUseCase,
} from '../../../usecases/exports/get-project-export.usecase';
import type {
  RequestProjectExportCommand,
  RequestProjectExportUseCase,
} from '../../../usecases/exports/request-project-export.usecase';
import { ExportsController, projectExportBody } from './exports.controller';

const ADMIN: AdminUser = {
  id: '00000000-0000-4000-a000-000000000001',
  email: 'owner@example.com',
  emailLanguage: 'en',
  suspendedAt: null,
  createdAt: new Date('2026-11-01T00:00:00.000Z'),
};
const PROJECT_ID = '00000000-0000-4000-b000-000000000001';
const PENDING: ProjectExport = {
  id: '00000000-0000-4000-e000-000000000001',
  projectId: PROJECT_ID,
  requestedBy: ADMIN.id,
  requestedAt: new Date('2026-11-02T13:00:00.000Z'),
  status: 'pending',
  finishedAt: null,
  objectKey: null,
  eventCount: null,
};
const DONE: ProjectExport = {
  ...PENDING,
  status: 'done',
  finishedAt: new Date('2026-11-02T13:01:00.000Z'),
  objectKey: 'exports/k.csv.gz',
  eventCount: 42,
};

const request = { admin: ADMIN } as unknown as FastifyRequest;

describe('projectExportBody', () => {
  it('writes an export in the API shape', () => {
    expect(
      projectExportBody(DONE, new Date('2026-11-09T13:01:00.000Z'), 'https://files.example.com/x'),
    ).toEqual({
      id: DONE.id,
      status: 'done',
      requested_at: '2026-11-02T13:00:00.000Z',
      finished_at: '2026-11-02T13:01:00.000Z',
      event_count: 42,
      available_until: '2026-11-09T13:01:00.000Z',
      download_url: 'https://files.example.com/x',
    });
  });
});

describe('ExportsController', () => {
  it('asks for an export in the name of the signed-in owner', async () => {
    const asked: RequestProjectExportCommand[] = [];
    const controller = new ExportsController(
      {
        execute: (command: RequestProjectExportCommand) => {
          asked.push(command);
          return Promise.resolve({ projectExport: PENDING, requested: true });
        },
      } as unknown as RequestProjectExportUseCase,
      {} as GetProjectExportUseCase,
    );

    const body = await controller.create(request, PROJECT_ID);

    expect(asked).toEqual([{ adminUserId: ADMIN.id, projectId: PROJECT_ID }]);
    expect(body).toEqual({
      requested: true,
      export: expect.objectContaining({
        id: PENDING.id,
        status: 'pending',
        download_url: null,
      }) as unknown,
    });
  });

  it('shows an export with its link once it is ready', async () => {
    const asked: GetProjectExportCommand[] = [];
    const controller = new ExportsController(
      {} as RequestProjectExportUseCase,
      {
        execute: (command: GetProjectExportCommand) => {
          asked.push(command);
          return Promise.resolve({
            projectExport: DONE,
            availableUntil: new Date('2026-11-09T13:01:00.000Z'),
            downloadUrl: 'https://files.example.com/x',
          });
        },
      } as unknown as GetProjectExportUseCase,
    );

    const body = await controller.show(request, PROJECT_ID, DONE.id);

    expect(asked).toEqual([{ adminUserId: ADMIN.id, projectId: PROJECT_ID, exportId: DONE.id }]);
    expect(body.download_url).toBe('https://files.example.com/x');
  });
});
