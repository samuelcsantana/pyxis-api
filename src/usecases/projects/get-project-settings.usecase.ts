import { Inject, Injectable } from '@nestjs/common';
import type { Project } from '../../domain/entities/project.entity';
import type { ProjectKey } from '../../domain/entities/project-key.entity';
import {
  NO_ACTIVITY,
  PROJECT_ACTIVITY_QUERY,
  type ProjectActivity,
  type ProjectActivityQuery,
} from '../../domain/queries/project-activity';
import {
  PROJECT_KEY_REPOSITORY,
  type ProjectKeyRepository,
} from '../../domain/repositories/project-key.repository';
import { EVENT_RETENTION_MONTHS } from '../../domain/retention/retention-policy';

export interface PublicKeySummary {
  readonly id: string;
  readonly publicKey: string;
  readonly createdAt: Date;
}

export interface SecretKeySummary {
  readonly id: string;
  readonly createdAt: Date;
}

export interface ProjectSettings extends Project, ProjectActivity {
  readonly publicKeys: readonly PublicKeySummary[];
  readonly secretKeys: readonly SecretKeySummary[];
  readonly eventRetentionMonths: number;
}

function publicKeysAmong(keys: readonly ProjectKey[]): readonly PublicKeySummary[] {
  return keys.flatMap((key) =>
    key.kind === 'public'
      ? [{ id: key.id, publicKey: key.publicKey, createdAt: key.createdAt }]
      : [],
  );
}

function secretKeysAmong(keys: readonly ProjectKey[]): readonly SecretKeySummary[] {
  return keys.flatMap((key) =>
    key.kind === 'secret' ? [{ id: key.id, createdAt: key.createdAt }] : [],
  );
}

@Injectable()
export class GetProjectSettingsUseCase {
  constructor(
    @Inject(PROJECT_KEY_REPOSITORY) private readonly keys: ProjectKeyRepository,
    @Inject(PROJECT_ACTIVITY_QUERY) private readonly activity: ProjectActivityQuery,
  ) {}

  async execute(project: Project): Promise<ProjectSettings> {
    const [keys, activity] = await Promise.all([
      this.keys.liveKeysOf(project.id),
      this.activity.activityOf([project.id]),
    ]);
    return {
      ...project,
      ...(activity.get(project.id) ?? NO_ACTIVITY),
      publicKeys: publicKeysAmong(keys),
      secretKeys: secretKeysAmong(keys),
      eventRetentionMonths: EVENT_RETENTION_MONTHS,
    };
  }
}
