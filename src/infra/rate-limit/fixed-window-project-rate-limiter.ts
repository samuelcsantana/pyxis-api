import type {
  ProjectRateLimiter,
  RateLimitDecision,
} from '../../domain/services/project-rate-limiter';

export const PROJECT_BATCHES_PER_WINDOW = 3_000;
export const PROJECT_RATE_WINDOW_MS = 60_000;

const MILLISECONDS_PER_SECOND = 1_000;

interface WindowCount {
  readonly windowStart: number;
  readonly count: number;
}

export class FixedWindowProjectRateLimiter implements ProjectRateLimiter {
  private readonly windows = new Map<string, WindowCount>();

  constructor(
    private readonly limit: number = PROJECT_BATCHES_PER_WINDOW,
    private readonly windowMs: number = PROJECT_RATE_WINDOW_MS,
  ) {}

  tryConsume(projectId: string, now: Date): RateLimitDecision {
    const time = now.getTime();
    const windowStart = time - (time % this.windowMs);
    const current = this.windows.get(projectId);
    const count = current?.windowStart === windowStart ? current.count : 0;
    if (count >= this.limit) {
      const windowEnd = windowStart + this.windowMs;
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((windowEnd - time) / MILLISECONDS_PER_SECOND)),
      };
    }
    this.windows.set(projectId, { windowStart, count: count + 1 });
    return { allowed: true };
  }
}
