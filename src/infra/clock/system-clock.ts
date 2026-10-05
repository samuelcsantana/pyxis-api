import type { Clock } from '../../domain/services/clock';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
