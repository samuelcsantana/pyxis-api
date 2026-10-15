import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  type ProjectAccountState,
  type ProjectAccountStateRepository,
  UNRESTRICTED_PROJECT,
} from '../../domain/repositories/project-account-state.repository';
import type { Clock } from '../../domain/services/clock';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { accounts } from '../database/schema/accounts';
import { projects } from '../database/schema/projects';

export const PROJECT_ACCOUNT_STATE_CACHE_TTL_MS = 60_000;

@Injectable()
export class DrizzleProjectAccountStateRepository implements ProjectAccountStateRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async stateOf(projectId: string): Promise<ProjectAccountState> {
    const [row] = await this.db
      .select({
        ingestionPausedUntil: accounts.ingestionPausedUntil,
        suspendedAt: accounts.suspendedAt,
        ingestionSuspendedAt: projects.ingestionSuspendedAt,
      })
      .from(projects)
      .leftJoin(accounts, eq(accounts.id, projects.accountId))
      .where(eq(projects.id, projectId))
      .limit(1);
    return row === undefined
      ? UNRESTRICTED_PROJECT
      : {
          ingestionPausedUntil: row.ingestionPausedUntil,
          suspended: row.suspendedAt !== null,
          ingestionSuspended: row.ingestionSuspendedAt !== null,
        };
  }
}

interface CachedState {
  readonly state: ProjectAccountState;
  readonly expiresAt: number;
}

export class CachingProjectAccountStateRepository implements ProjectAccountStateRepository {
  private readonly cache = new Map<string, CachedState>();

  constructor(
    private readonly delegate: ProjectAccountStateRepository,
    private readonly clock: Clock,
    private readonly ttlMs: number = PROJECT_ACCOUNT_STATE_CACHE_TTL_MS,
  ) {}

  async stateOf(projectId: string): Promise<ProjectAccountState> {
    const now = this.clock.now().getTime();
    const cached = this.cache.get(projectId);
    if (cached !== undefined && cached.expiresAt > now) {
      return cached.state;
    }
    const state = await this.delegate.stateOf(projectId);
    this.cache.set(projectId, { state, expiresAt: now + this.ttlMs });
    return state;
  }
}
