import type { Project } from '../domain/entities/project.entity';
import type { ProjectKey } from '../domain/entities/project-key.entity';
import type {
  LiveSecretKey,
  NewProjectKey,
  ProjectKeyRepository,
} from '../domain/repositories/project-key.repository';
import type { ProjectRepository } from '../domain/repositories/project.repository';
import type {
  AccountProjectSlot,
  CreatedProject,
  DeletedProject,
  NewProject,
  ProjectChanges,
  ProjectInAccount,
  ProjectSettingsRepository,
} from '../domain/repositories/project-settings.repository';

const CREATED_AT = new Date('2026-10-06T00:00:00.000Z');

export interface ProjectAccessGrant {
  readonly adminUserId: string;
  readonly projectId: string;
}

export class InMemoryProjectRepository
  implements ProjectRepository, ProjectSettingsRepository, ProjectKeyRepository
{
  private readonly projects = new Map<string, Project>();
  private readonly eventCounts = new Map<string, number>();
  private keys: ProjectKey[] = [];
  private readonly accountOwners = new Map<string, string>();
  private readonly projectAccounts = new Map<string, string>();
  private readonly ownerGrants: ProjectAccessGrant[] = [];
  private sequence = 0;

  get grantedToOwners(): readonly ProjectAccessGrant[] {
    return this.ownerGrants;
  }

  addAccount(accountId: string, ownerAdminId: string): void {
    this.accountOwners.set(accountId, ownerAdminId);
  }

  accountOf(projectId: string): string | null {
    return this.projectAccounts.get(projectId) ?? null;
  }

  get storedKeys(): readonly ProjectKey[] {
    return this.keys;
  }

  add(project: Project, ...keys: readonly ProjectKey[]): void {
    this.projects.set(project.id, project);
    this.keys.push(...keys);
  }

  recordEvents(projectId: string, total: number): void {
    this.eventCounts.set(projectId, total);
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
    const created: Project = {
      ...project,
      id: this.nextId(),
      cityEnabled: false,
      createdAt: CREATED_AT,
    };
    this.projects.set(created.id, created);
    const key = await this.create({ projectId: created.id, kind: 'public', publicKey });
    return { project: created, publicKeyId: key.id };
  }

  async createWithPublicKeyInAccount(
    project: NewProject,
    publicKey: string,
    slot: AccountProjectSlot,
  ): Promise<ProjectInAccount> {
    const ownerAdminId = this.accountOwners.get(slot.accountId);
    if (ownerAdminId === undefined) {
      return { outcome: 'account_not_found' };
    }
    const held = [...this.projectAccounts.values()].filter(
      (accountId) => accountId === slot.accountId,
    ).length;
    if (held >= slot.maxProjects) {
      return { outcome: 'project_limit_reached' };
    }
    const created = await this.createWithPublicKey(project, publicKey);
    this.projectAccounts.set(created.project.id, slot.accountId);
    this.ownerGrants.push({ adminUserId: ownerAdminId, projectId: created.project.id });
    return { outcome: 'created', created };
  }

  findById(projectId: string): Promise<Project | null> {
    return Promise.resolve(this.projects.get(projectId) ?? null);
  }

  accountIdOf(projectId: string): Promise<string | null> {
    return Promise.resolve(this.accountOf(projectId));
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

  deleteWithEverything(projectId: string): Promise<DeletedProject | null> {
    const project = this.projects.get(projectId);
    if (project === undefined) {
      return Promise.resolve(null);
    }
    const deletedKeys = this.keys.filter((key) => key.projectId === projectId).length;
    const deletedEvents = this.eventCounts.get(projectId) ?? 0;
    this.projects.delete(projectId);
    this.projectAccounts.delete(projectId);
    this.eventCounts.delete(projectId);
    this.keys = this.keys.filter((key) => key.projectId !== projectId);
    return Promise.resolve({ project, deletedEvents, deletedKeys });
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

  findLiveSecret(secretHash: string): Promise<LiveSecretKey | null> {
    const key = this.keys.find(
      (candidate) =>
        candidate.kind === 'secret' &&
        candidate.secretHash === secretHash &&
        candidate.revokedAt === null,
    );
    return Promise.resolve(
      key?.kind === 'secret'
        ? { keyId: key.id, projectId: key.projectId, secretHash: key.secretHash }
        : null,
    );
  }

  liveKeysOf(projectId: string): Promise<readonly ProjectKey[]> {
    return Promise.resolve(
      this.keys.filter((key) => key.projectId === projectId && key.revokedAt === null),
    );
  }

  private nextId(): string {
    this.sequence += 1;
    return `00000000-0000-4000-8000-${String(this.sequence).padStart(12, '0')}`;
  }
}
