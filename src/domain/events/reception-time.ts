import { MAX_ARRIVAL_AGE_MS } from './event-limits';

export function receptionTime(arrivedAt: Date | undefined, now: Date): Date {
  if (arrivedAt === undefined) {
    return now;
  }
  const ageMs = now.getTime() - arrivedAt.getTime();
  return ageMs >= 0 && ageMs <= MAX_ARRIVAL_AGE_MS ? arrivedAt : now;
}
