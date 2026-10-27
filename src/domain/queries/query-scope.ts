import type { DateRange } from './date-range';
import type { ReportFilters } from './report-filters';

export interface QueryScope {
  readonly projectId: string;
  readonly timeZone: string;
  readonly conversionEvent: string | null;
  readonly range: DateRange;
  readonly lastDayUntil?: string;
  readonly filters: ReportFilters;
}
