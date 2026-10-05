import type { Project } from '../domain/entities/project.entity';
import type { ProjectKey } from '../domain/entities/project-key.entity';
import type { ProjectRepository } from '../domain/repositories/project.repository';

interface KeyedProject {
  readonly project: Project;
  readonly key: ProjectKey;
}

export class InMemoryProjectRepository implements ProjectRepository {
  private readonly entries: KeyedProject[] = [];

  add(project: Project, ...keys: readonly ProjectKey[]): void {
    this.entries.push(...keys.map((key) => ({ project, key })));
  }

  findByPublicKey(publicKey: string): Promise<Project | null> {
    const entry = this.entries.find(
      ({ key }) => key.kind === 'public' && key.publicKey === publicKey && key.revokedAt === null,
    );
    return Promise.resolve(entry?.project ?? null);
  }
}
