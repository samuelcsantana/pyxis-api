import type { Project } from '../entities/project.entity';

export interface NewProject {
  readonly name: string;
  readonly allowedOrigins: readonly string[];
  readonly timezone: string;
  readonly conversionEvent: string | null;
}

export interface ProjectChanges {
  readonly allowedOrigins?: readonly string[];
  readonly timezone?: string;
  readonly conversionEvent?: string | null;
}

export interface CreatedProject {
  readonly project: Project;
  readonly publicKeyId: string;
}

export interface DeletedProject {
  readonly project: Project;
  readonly deletedEvents: number;
  readonly deletedKeys: number;
}

export interface ProjectSettingsRepository {
  createWithPublicKey(project: NewProject, publicKey: string): Promise<CreatedProject>;
  findById(projectId: string): Promise<Project | null>;
  update(projectId: string, changes: ProjectChanges): Promise<Project | null>;
  deleteWithEverything(projectId: string): Promise<DeletedProject | null>;
}

export const PROJECT_SETTINGS_REPOSITORY = Symbol('ProjectSettingsRepository');
