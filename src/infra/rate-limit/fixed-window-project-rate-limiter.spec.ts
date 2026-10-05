import {
  FixedWindowProjectRateLimiter,
  PROJECT_BATCHES_PER_WINDOW,
  PROJECT_RATE_WINDOW_MS,
} from './fixed-window-project-rate-limiter';

const WINDOW_START = new Date('2026-10-06T14:00:00.000Z');

function at(offsetMs: number): Date {
  return new Date(WINDOW_START.getTime() + offsetMs);
}

describe('FixedWindowProjectRateLimiter', () => {
  it('allows up to the limit within a window and refuses the next batch', () => {
    const limiter = new FixedWindowProjectRateLimiter(2);

    expect(limiter.tryConsume('project', at(0))).toEqual({ allowed: true });
    expect(limiter.tryConsume('project', at(1_000))).toEqual({ allowed: true });
    expect(limiter.tryConsume('project', at(20_500))).toEqual({
      allowed: false,
      retryAfterSeconds: 40,
    });
  });

  it('starts counting again in the next window', () => {
    const limiter = new FixedWindowProjectRateLimiter(1);

    limiter.tryConsume('project', at(0));

    expect(limiter.tryConsume('project', at(PROJECT_RATE_WINDOW_MS))).toEqual({ allowed: true });
  });

  it('asks to wait at least one second at the very end of a window', () => {
    const limiter = new FixedWindowProjectRateLimiter(1);

    limiter.tryConsume('project', at(0));

    expect(limiter.tryConsume('project', at(PROJECT_RATE_WINDOW_MS - 1))).toEqual({
      allowed: false,
      retryAfterSeconds: 1,
    });
  });

  it('counts each project on its own', () => {
    const limiter = new FixedWindowProjectRateLimiter(1);

    limiter.tryConsume('first', at(0));

    expect(limiter.tryConsume('second', at(0))).toEqual({ allowed: true });
  });

  it(`defaults to ${String(PROJECT_BATCHES_PER_WINDOW)} batches per minute`, () => {
    const limiter = new FixedWindowProjectRateLimiter();
    for (let batch = 0; batch < PROJECT_BATCHES_PER_WINDOW; batch += 1) {
      limiter.tryConsume('project', at(0));
    }

    expect(limiter.tryConsume('project', at(0)).allowed).toBe(false);
  });
});
