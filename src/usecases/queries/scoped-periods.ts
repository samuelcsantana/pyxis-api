import type { Project } from '../../domain/entities/project.entity';
import {
  checkedRange,
  comparisonCutoff,
  previousRange,
  todayIn,
} from '../../domain/queries/date-range';
import type { QueryScope } from '../../domain/queries/query-scope';

export interface RequestedRange {
  readonly from: string;
  readonly to: string;
}

export interface ScopedPeriods {
  readonly current: QueryScope;
  readonly previous: QueryScope;
  readonly comparisonCutoff: string | null;
}

export function scopedPeriods(
  project: Project,
  requested: RequestedRange,
  now: Date,
): ScopedPeriods {
  const range = checkedRange(requested.from, requested.to, todayIn(project.timezone, now));
  const current: QueryScope = {
    projectId: project.id,
    timeZone: project.timezone,
    conversionEvent: project.conversionEvent,
    range,
  };
  const previous: QueryScope = { ...current, range: previousRange(range) };
  const cutoff = comparisonCutoff(range, project.timezone, now);
  return {
    current,
    previous: cutoff === null ? previous : { ...previous, lastDayUntil: cutoff },
    comparisonCutoff: cutoff,
  };
}
