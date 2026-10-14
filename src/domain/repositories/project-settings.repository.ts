import type { Project } from '../entities/project.entity';

export interface NewProject {
  readonly name: string;
  readonly allowedOrigins: readonly string[];
  readonly timezone: string;
  readonly conversionEvent: string | null;
}

export interface ProjectChanges {
  readonly name?: string;
  readonly allowedOrigins?: readonly string[];
  readonly timezone?: string;
  readonly conversionEvent?: string | null;
}

export interface CreatedProject {
  readonly project: Project;
  readonly publicKeyId: string;
}

export interface AccountProjectSlot {
  readonly accountId: string;
  readonly maxProjects: number;
}

export type ProjectInAccount =
  | { readonly outcome: 'created'; readonly created: CreatedProject }
  | { readonly outcome: 'account_not_found' }
  | { readonly outcome: 'project_limit_reached' };

export interface DeletedProject {
  readonly project: Project;
  readonly deletedEvents: number;
  readonly deletedKeys: number;
}

export interface ProjectSettingsRepository {
  createWithPublicKey(project: NewProject, publicKey: string): Promise<CreatedProject>;
  createWithPublicKeyInAccount(
    project: NewProject,
    publicKey: string,
    slot: AccountProjectSlot,
  ): Promise<ProjectInAccount>;
  findById(projectId: string): Promise<Project | null>;
  accountIdOf(projectId: string): Promise<string | null>;
  update(projectId: string, changes: ProjectChanges): Promise<Project | null>;
  deleteWithEverything(projectId: string): Promise<DeletedProject | null>;
}

export const PROJECT_SETTINGS_REPOSITORY = Symbol('ProjectSettingsRepository');
