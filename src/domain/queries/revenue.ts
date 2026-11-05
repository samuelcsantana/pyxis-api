import type { GoalTarget } from '../goals/goal';

export interface RevenueDay {
  readonly date: string;
  readonly revenue: number;
}

export function carriesRevenue(target: GoalTarget | null): boolean {
  return target?.type === 'event';
}
