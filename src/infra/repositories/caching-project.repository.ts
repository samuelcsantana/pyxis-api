import type { Project } from '../../domain/entities/project.entity';
import type { ProjectRepository } from '../../domain/repositories/project.repository';
import type { Clock } from '../../domain/services/clock';

export const PROJECT_KEY_CACHE_TTL_MS = 60_000;

interface CachedProject {
  readonly project: Project;
  readonly expiresAt: number;
}

export class CachingProjectRepository implements ProjectRepository {
  private readonly cache = new Map<string, CachedProject>();

  constructor(
    private readonly delegate: ProjectRepository,
    private readonly clock: Clock,
    private readonly ttlMs: number = PROJECT_KEY_CACHE_TTL_MS,
  ) {}

  async findByPublicKey(publicKey: string): Promise<Project | null> {
    const now = this.clock.now().getTime();
    const cached = this.cache.get(publicKey);
    if (cached !== undefined && cached.expiresAt > now) {
      return cached.project;
    }
    this.cache.delete(publicKey);
    const project = await this.delegate.findByPublicKey(publicKey);
    if (project !== null) {
      this.cache.set(publicKey, { project, expiresAt: now + this.ttlMs });
    }
    return project;
  }
}
