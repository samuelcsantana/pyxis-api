import type { Project } from '../../domain/entities/project.entity';
import type { ProjectRepository } from '../../domain/repositories/project.repository';
import type { Clock } from '../../domain/services/clock';

export const PROJECT_KEY_CACHE_TTL_MS = 60_000;
export const UNKNOWN_KEY_CACHE_LIMIT = 1_000;

interface CachedProject {
  readonly project: Project;
  readonly expiresAt: number;
}

export class CachingProjectRepository implements ProjectRepository {
  private readonly cache = new Map<string, CachedProject>();
  private readonly unknownKeys = new Map<string, number>();

  constructor(
    private readonly delegate: ProjectRepository,
    private readonly clock: Clock,
    private readonly ttlMs: number = PROJECT_KEY_CACHE_TTL_MS,
    private readonly unknownKeyLimit: number = UNKNOWN_KEY_CACHE_LIMIT,
  ) {}

  async findByPublicKey(publicKey: string): Promise<Project | null> {
    const now = this.clock.now().getTime();
    const cached = this.cache.get(publicKey);
    if (cached !== undefined && cached.expiresAt > now) {
      return cached.project;
    }
    this.cache.delete(publicKey);
    if (this.isRememberedAsUnknown(publicKey, now)) {
      return null;
    }
    const project = await this.delegate.findByPublicKey(publicKey);
    if (project === null) {
      this.rememberUnknown(publicKey, now);
    } else {
      this.cache.set(publicKey, { project, expiresAt: now + this.ttlMs });
    }
    return project;
  }

  private isRememberedAsUnknown(publicKey: string, now: number): boolean {
    const expiresAt = this.unknownKeys.get(publicKey);
    if (expiresAt === undefined) {
      return false;
    }
    if (expiresAt > now) {
      return true;
    }
    this.unknownKeys.delete(publicKey);
    return false;
  }

  private rememberUnknown(publicKey: string, now: number): void {
    const [oldest] = this.unknownKeys.keys();
    if (oldest !== undefined && this.unknownKeys.size >= this.unknownKeyLimit) {
      this.unknownKeys.delete(oldest);
    }
    this.unknownKeys.set(publicKey, now + this.ttlMs);
  }
}
