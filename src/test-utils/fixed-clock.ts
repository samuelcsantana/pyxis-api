import type { Clock } from '../domain/services/clock';

export class FixedClock implements Clock {
  constructor(private readonly current: Date) {}

  now(): Date {
    return this.current;
  }
}
