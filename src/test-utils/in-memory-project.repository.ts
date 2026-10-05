import type { Project } from '../domain/entities/project.entity';
import type { ProjectKey } from '../domain/entities/project-key.entity';
import type {
  NewProjectKey,
  ProjectKeyRepository,
} from '../domain/repositories/project-key.repository';
import type { ProjectRepository } from '../domain/repositories/project.repository';
import type {
  CreatedProject,
  NewProject,
  ProjectChanges,
  ProjectSettingsRepository,
} from '../domain/repositories/project-settings.repository';

const CREATED_AT = new Date('2026-10-06T00:00:00.000Z');

export class InMemoryProjectRepository
  implements ProjectRepository, ProjectSettingsRepository, ProjectKeyRepository
{
  private readonly projects = new Map<string, Project>();
  private keys: ProjectKey[] = [];
  private sequence = 0;

  get storedKeys(): readonly ProjectKey[] {
    return this.keys;
  }

  add(project: Project, ...keys: readonly ProjectKey[]): void {
    this.projects.set(project.id, project);
    this.keys.push(...keys);
  }

  findByPublicKey(publicKey: string): Promise<Project | null> {
    const key = this.keys.find(
      (candidate) =>
        candidate.kind === 'public' &&
        candidate.publicKey === publicKey &&
        candidate.revokedAt === null,
    );
    const project = key && this.projects.get(key.projectId);
    return Promise.resolve(project ?? null);
  }

  async createWithPublicKey(project: NewProject, publicKey: string): Promise<CreatedProject> {
    const created: Project = { ...project, id: this.nextId(), createdAt: CREATED_AT };
    this.projects.set(created.id, created);
    const key = await this.create({ projectId: created.id, kind: 'public', publicKey });
    return { project: created, publicKeyId: key.id };
  }

  findById(projectId: string): Promise<Project | null> {
    return Promise.resolve(this.projects.get(projectId) ?? null);
  }

  update(projectId: string, changes: ProjectChanges): Promise<Project | null> {
    const current = this.projects.get(projectId);
    if (current === undefined) {
      return Promise.resolve(null);
    }
    const updated: Project = { ...current, ...changes };
    this.projects.set(projectId, updated);
    return Promise.resolve(updated);
  }

  create(key: NewProjectKey): Promise<ProjectKey> {
    const created: ProjectKey = {
      ...key,
      id: this.nextId(),
      createdAt: CREATED_AT,
      revokedAt: null,
    };
    this.keys.push(created);
    return Promise.resolve(created);
  }

  revoke(keyId: string, revokedAt: Date): Promise<boolean> {
    const live = this.keys.some((key) => key.id === keyId && key.revokedAt === null);
    this.keys = this.keys.map((key) =>
      key.id === keyId && key.revokedAt === null ? { ...key, revokedAt } : key,
    );
    return Promise.resolve(live);
  }

  private nextId(): string {
    this.sequence += 1;
    return `00000000-0000-4000-8000-${String(this.sequence).padStart(12, '0')}`;
  }
}
