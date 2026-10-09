import type { QueryScope } from './query-scope';

export const WEEKDAYS = 7;
export const HOURS_IN_A_DAY = 24;

export interface VisitStartCell {
  readonly weekday: number;
  readonly hour: number;
  readonly visits: number;
}

export interface TimeOfDayQuery {
  visitStarts(scope: QueryScope): Promise<readonly VisitStartCell[]>;
}

export const TIME_OF_DAY_QUERY = Symbol('TimeOfDayQuery');

export interface WeekdayHours {
  readonly weekday: number;
  readonly hours: readonly number[];
}

export type TimeOfDayReport = readonly WeekdayHours[];

function cellKey(weekday: number, hour: number): string {
  return `${String(weekday)}:${String(hour)}`;
}

export function weekdayHours(cells: readonly VisitStartCell[]): TimeOfDayReport {
  const visitsAt = new Map(cells.map((cell) => [cellKey(cell.weekday, cell.hour), cell.visits]));
  return Array.from({ length: WEEKDAYS }, (_, index) => {
    const weekday = index + 1;
    return {
      weekday,
      hours: Array.from(
        { length: HOURS_IN_A_DAY },
        (_, hour) => visitsAt.get(cellKey(weekday, hour)) ?? 0,
      ),
    };
  });
}
