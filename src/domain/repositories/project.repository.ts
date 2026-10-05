import type { Project } from '../entities/project.entity';

export interface ProjectRepository {
  findByPublicKey(publicKey: string): Promise<Project | null>;
}

export const PROJECT_REPOSITORY = Symbol('ProjectRepository');
