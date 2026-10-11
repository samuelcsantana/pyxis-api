import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Project } from '../../../domain/entities/project.entity';
import type { ProjectIcon } from '../../../domain/repositories/project-icon.repository';
import type { GetProjectIconUseCase } from '../../../usecases/projects/get-project-icon.usecase';
import { PROJECT_ICON_CACHE_CONTROL, ProjectIconController } from './project-icon.controller';

const PROJECT: Project = {
  id: '6f1d3c2a-8b4e-4f7a-9c1d-2e3f4a5b6c7d',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'America/Sao_Paulo',
  conversionEvent: null,
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
};

const ICON: ProjectIcon = {
  projectId: PROJECT.id,
  contentType: 'image/png',
  bytes: Uint8Array.from([0x89, 0x50, 0x4e, 0x47]),
  version: '0123456789abcdef',
  sourceUrl: 'https://shop.example.com/icon.png',
  fetchedAt: new Date('2026-10-11T06:00:00.000Z'),
};

describe('ProjectIconController', () => {
  it('answers the bytes of the icon with its type and a private day-long cache', async () => {
    const asked: string[] = [];
    const useCase = {
      execute: (projectId: string) => {
        asked.push(projectId);
        return Promise.resolve(ICON);
      },
    } as unknown as GetProjectIconUseCase;
    const headers = new Map<string, string>();
    const reply = {
      header: (name: string, value: string) => {
        headers.set(name, value);
        return reply;
      },
    } as unknown as FastifyReply;

    const body = await new ProjectIconController(useCase).icon(
      { project: PROJECT } as unknown as FastifyRequest,
      reply,
    );

    expect(asked).toEqual([PROJECT.id]);
    expect(body).toEqual(Buffer.from(ICON.bytes));
    expect(Object.fromEntries(headers)).toEqual({
      'content-type': 'image/png',
      'cache-control': PROJECT_ICON_CACHE_CONTROL,
    });
  });
});
