import { Inject, Injectable } from '@nestjs/common';
import type { Project } from '../../domain/entities/project.entity';
import { ProjectNotFoundError } from '../../domain/errors/project.errors';
import {
  requireConversionEvent,
  requireOrigins,
  requireTimeZone,
} from '../../domain/projects/project-settings';
import {
  PROJECT_SETTINGS_REPOSITORY,
  type ProjectChanges,
  type ProjectSettingsRepository,
} from '../../domain/repositories/project-settings.repository';

export interface UpdateProjectCommand {
  readonly projectId: string;
  readonly allowedOrigins?: readonly string[];
  readonly timezone?: string;
  readonly conversionEvent?: string | null;
}

function validatedChanges(command: UpdateProjectCommand): ProjectChanges {
  const { allowedOrigins, timezone, conversionEvent } = command;
  return {
    ...(allowedOrigins === undefined ? {} : { allowedOrigins: requireOrigins(allowedOrigins) }),
    ...(timezone === undefined ? {} : { timezone: requireTimeZone(timezone) }),
    ...(conversionEvent === undefined
      ? {}
      : {
          conversionEvent:
            conversionEvent === null ? null : requireConversionEvent(conversionEvent),
        }),
  };
}

@Injectable()
export class UpdateProjectUseCase {
  constructor(
    @Inject(PROJECT_SETTINGS_REPOSITORY) private readonly projects: ProjectSettingsRepository,
  ) {}

  async execute(command: UpdateProjectCommand): Promise<Project> {
    const updated = await this.projects.update(command.projectId, validatedChanges(command));
    if (updated === null) {
      throw new ProjectNotFoundError();
    }
    return updated;
  }
}
