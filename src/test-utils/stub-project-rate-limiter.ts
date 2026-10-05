import type {
  ProjectRateLimiter,
  RateLimitDecision,
} from '../domain/services/project-rate-limiter';

export class StubProjectRateLimiter implements ProjectRateLimiter {
  readonly calls: { readonly projectId: string; readonly now: Date }[] = [];

  constructor(private decision: RateLimitDecision = { allowed: true }) {}

  decide(decision: RateLimitDecision): void {
    this.decision = decision;
  }

  tryConsume(projectId: string, now: Date): RateLimitDecision {
    this.calls.push({ projectId, now });
    return this.decision;
  }
}
