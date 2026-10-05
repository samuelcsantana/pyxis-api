import { Inject, Injectable } from '@nestjs/common';
import { generatePublicKey } from '../../domain/keys/project-keys';
import {
  DEFAULT_TIMEZONE,
  requireConversionEvent,
  requireOrigins,
  requireProjectName,
  requireTimeZone,
} from '../../domain/projects/project-settings';
import {
  PROJECT_SETTINGS_REPOSITORY,
  type ProjectSettingsRepository,
} from '../../domain/repositories/project-settings.repository';
import { RANDOM_SOURCE, type RandomSource } from '../../domain/services/random-source';

export interface CreateProjectCommand {
  readonly name: string;
  readonly allowedOrigins: readonly string[];
  readonly timezone?: string;
  readonly conversionEvent?: string;
}

export interface CreateProjectResult {
  readonly projectId: string;
  readonly publicKeyId: string;
  readonly publicKey: string;
}

@Injectable()
export class CreateProjectUseCase {
  constructor(
    @Inject(PROJECT_SETTINGS_REPOSITORY) private readonly projects: ProjectSettingsRepository,
    @Inject(RANDOM_SOURCE) private readonly random: RandomSource,
  ) {}

  async execute(command: CreateProjectCommand): Promise<CreateProjectResult> {
    const settings = {
      name: requireProjectName(command.name),
      allowedOrigins: requireOrigins(command.allowedOrigins),
      timezone: requireTimeZone(command.timezone ?? DEFAULT_TIMEZONE),
      conversionEvent:
        command.conversionEvent === undefined
          ? null
          : requireConversionEvent(command.conversionEvent),
    };
    const publicKey = generatePublicKey(this.random);
    const created = await this.projects.createWithPublicKey(settings, publicKey);
    return { projectId: created.project.id, publicKeyId: created.publicKeyId, publicKey };
  }
}
