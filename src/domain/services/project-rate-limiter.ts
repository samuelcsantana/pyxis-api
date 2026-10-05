export type RateLimitDecision =
  { readonly allowed: true } | { readonly allowed: false; readonly retryAfterSeconds: number };

export interface ProjectRateLimiter {
  tryConsume(projectId: string, now: Date): RateLimitDecision;
}

export const PROJECT_RATE_LIMITER = Symbol('ProjectRateLimiter');
