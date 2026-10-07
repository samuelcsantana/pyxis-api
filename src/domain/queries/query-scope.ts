import type { DateRange } from './date-range';

export interface QueryScope {
  readonly projectId: string;
  readonly timeZone: string;
  readonly conversionEvent: string | null;
  readonly range: DateRange;
  readonly lastDayUntil?: string;
}
