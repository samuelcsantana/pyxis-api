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
  ACCOUNT_REPOSITORY,
  type AccountRepository,
  type AccountRole,
} from '../../domain/repositories/account.repository';
import {
  PROJECT_KEY_REPOSITORY,
  type ProjectKeyRepository,
} from '../../domain/repositories/project-key.repository';
import {
  PROJECT_SETTINGS_REPOSITORY,
  type ProjectSettingsRepository,
} from '../../domain/repositories/project-settings.repository';
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

export interface ProjectOwnership {
  readonly accountId: string | null;
  readonly role: AccountRole | null;
}

const OPERATORS_PROJECT: ProjectOwnership = { accountId: null, role: null };

export interface ProjectSettings extends Project, ProjectActivity, ProjectOwnership {
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
    @Inject(PROJECT_SETTINGS_REPOSITORY) private readonly projects: ProjectSettingsRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
  ) {}

  async execute(project: Project, adminUserId: string): Promise<ProjectSettings> {
    const [keys, activity, ownership] = await Promise.all([
      this.keys.liveKeysOf(project.id),
      this.activity.activityOf([project.id]),
      this.ownershipOf(project.id, adminUserId),
    ]);
    return {
      ...project,
      ...(activity.get(project.id) ?? NO_ACTIVITY),
      ...ownership,
      publicKeys: publicKeysAmong(keys),
      secretKeys: secretKeysAmong(keys),
      eventRetentionMonths: EVENT_RETENTION_MONTHS,
    };
  }

  private async ownershipOf(projectId: string, adminUserId: string): Promise<ProjectOwnership> {
    const accountId = await this.projects.accountIdOf(projectId);
    if (accountId === null) {
      return OPERATORS_PROJECT;
    }
    const account = await this.accounts.findById(accountId);
    return { accountId, role: account?.ownerAdminId === adminUserId ? 'owner' : 'member' };
  }
}
