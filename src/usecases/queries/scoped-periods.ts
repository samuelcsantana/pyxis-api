import type { Project } from '../../domain/entities/project.entity';
import { checkedRange, previousRange, todayIn } from '../../domain/queries/date-range';
import type { QueryScope } from '../../domain/queries/query-scope';

export interface RequestedRange {
  readonly from: string;
  readonly to: string;
}

export interface ScopedPeriods {
  readonly current: QueryScope;
  readonly previous: QueryScope;
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
  return { current, previous: { ...current, range: previousRange(range) } };
}
