import { InvalidUsageMonthError } from '../errors/query.errors';

export interface ProjectUsage {
  readonly projectId: string;
  readonly name: string;
  readonly events: number;
  readonly visits: number;
}

export interface UsageMonth {
  readonly from: Date;
  readonly to: Date;
}

export interface ProjectUsageQuery {
  usageBetween(from: Date, to: Date): Promise<readonly ProjectUsage[]>;
}

export const PROJECT_USAGE_QUERY = Symbol('ProjectUsageQuery');

const MONTH_LABEL = /^(\d{4})-(0[1-9]|1[0-2])$/;
const MONTH_LABEL_LENGTH = 7;

export function usageMonth(label: string): UsageMonth {
  const match = MONTH_LABEL.exec(label);
  if (match === null) {
    throw new InvalidUsageMonthError();
  }
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  return {
    from: new Date(Date.UTC(year, monthIndex, 1)),
    to: new Date(Date.UTC(year, monthIndex + 1, 1)),
  };
}

export function monthLabelOf(moment: Date): string {
  return moment.toISOString().slice(0, MONTH_LABEL_LENGTH);
}
