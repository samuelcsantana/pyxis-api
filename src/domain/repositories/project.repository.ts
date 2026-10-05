import type { Project } from '../entities/project.entity';

export interface ProjectRepository {
  findByPublicKey(publicKey: string): Promise<Project | null>;
}
