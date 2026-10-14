import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { IngestionPauseRepository } from '../../domain/repositories/ingestion-pause.repository';
import type { Clock } from '../../domain/services/clock';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { accounts } from '../database/schema/accounts';
import { projects } from '../database/schema/projects';

export const INGESTION_PAUSE_CACHE_TTL_MS = 60_000;

@Injectable()
export class DrizzleIngestionPauseRepository implements IngestionPauseRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async pausedUntil(projectId: string): Promise<Date | null> {
    const [row] = await this.db
      .select({ pausedUntil: accounts.ingestionPausedUntil })
      .from(projects)
      .innerJoin(accounts, eq(accounts.id, projects.accountId))
      .where(eq(projects.id, projectId))
      .limit(1);
    return row?.pausedUntil ?? null;
  }
}

interface CachedPause {
  readonly pausedUntil: Date | null;
  readonly expiresAt: number;
}

export class CachingIngestionPauseRepository implements IngestionPauseRepository {
  private readonly cache = new Map<string, CachedPause>();

  constructor(
    private readonly delegate: IngestionPauseRepository,
    private readonly clock: Clock,
    private readonly ttlMs: number = INGESTION_PAUSE_CACHE_TTL_MS,
  ) {}

  async pausedUntil(projectId: string): Promise<Date | null> {
    const now = this.clock.now().getTime();
    const cached = this.cache.get(projectId);
    if (cached !== undefined && cached.expiresAt > now) {
      return cached.pausedUntil;
    }
    const pausedUntil = await this.delegate.pausedUntil(projectId);
    this.cache.set(projectId, { pausedUntil, expiresAt: now + this.ttlMs });
    return pausedUntil;
  }
}
