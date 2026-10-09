import type { FastifyRequest } from 'fastify';
import type { Project } from '../../../domain/entities/project.entity';
import type {
  GetProjectSettingsUseCase,
  ProjectSettings,
} from '../../../usecases/projects/get-project-settings.usecase';
import { ProjectSettingsController } from './project-settings.controller';
import { projectSettingsSchema } from './project-settings.schemas';

const PROJECT: Project = {
  id: '6f1d3c2a-8b4e-4f7a-9c1d-2e3f4a5b6c7d',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'America/Sao_Paulo',
  conversionEvent: 'signup_completed',
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
};
const PUBLIC_KEY_ID = '0b7e1c2d-3f4a-4b5c-9d6e-7f8a9b0c1d2e';
const SECRET_KEY_ID = '1c8f2d3e-4a5b-4c6d-8e7f-8a9b0c1d2e3f';
const KEY_CREATED_AT = new Date('2026-10-02T08:00:00.000Z');

function controllerAnswering(settings: ProjectSettings) {
  const asked: Project[] = [];
  const useCase = {
    execute: (project: Project) => {
      asked.push(project);
      return Promise.resolve(settings);
    },
  };
  return {
    controller: new ProjectSettingsController(useCase as unknown as GetProjectSettingsUseCase),
    asked,
  };
}

describe('ProjectSettingsController', () => {
  it('answers the settings of the project in the contract shape', async () => {
    const { controller, asked } = controllerAnswering({
      ...PROJECT,
      firstEventAt: new Date('2026-10-03T10:00:00.000Z'),
      lastEventAt: new Date('2026-10-05T09:30:00.000Z'),
      publicKeys: [
        { id: PUBLIC_KEY_ID, publicKey: `pyxis_pk_${'A'.repeat(32)}`, createdAt: KEY_CREATED_AT },
      ],
      secretKeys: [{ id: SECRET_KEY_ID, createdAt: KEY_CREATED_AT }],
      eventRetentionMonths: 13,
    });

    const body = await controller.settings({ project: PROJECT } as FastifyRequest);

    expect(asked).toEqual([PROJECT]);
    expect(projectSettingsSchema.parse(body)).toEqual({
      id: PROJECT.id,
      name: 'Shop',
      timezone: 'America/Sao_Paulo',
      conversion_event: 'signup_completed',
      allowed_origins: ['https://shop.example.com'],
      created_at: '2026-10-01T00:00:00.000Z',
      first_event_at: '2026-10-03T10:00:00.000Z',
      last_event_at: '2026-10-05T09:30:00.000Z',
      event_retention_months: 13,
      public_keys: [
        {
          id: PUBLIC_KEY_ID,
          key: `pyxis_pk_${'A'.repeat(32)}`,
          created_at: '2026-10-02T08:00:00.000Z',
        },
      ],
      secret_keys: [{ id: SECRET_KEY_ID, created_at: '2026-10-02T08:00:00.000Z' }],
    });
  });

  it('answers null activity and no conversion event for a project still waiting for events', async () => {
    const { controller } = controllerAnswering({
      ...PROJECT,
      conversionEvent: null,
      firstEventAt: null,
      lastEventAt: null,
      publicKeys: [],
      secretKeys: [],
      eventRetentionMonths: 13,
    });

    const body = await controller.settings({ project: PROJECT } as FastifyRequest);

    expect(body).toMatchObject({
      conversion_event: null,
      first_event_at: null,
      last_event_at: null,
      public_keys: [],
      secret_keys: [],
    });
  });
});
