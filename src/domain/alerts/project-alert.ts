export const ALERT_KINDS = ['no_events', 'failed_writes', 'conversion_drop'] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];

export const ALERTS_BY_DEFAULT = true;

interface AlertAbout {
  readonly projectId: string;
  readonly projectName: string;
  readonly timeZone: string;
}

export interface NoEventsAlert extends AlertAbout {
  readonly kind: 'no_events';
  readonly lastEventAt: Date;
  readonly visitsBefore: number;
}

export interface FailedWritesAlert extends AlertAbout {
  readonly kind: 'failed_writes';
  readonly day: string;
  readonly failed: number;
  readonly total: number;
  readonly usualRate: number;
}

export interface ConversionDropAlert extends AlertAbout {
  readonly kind: 'conversion_drop';
  readonly goalName: string;
  readonly day: string;
  readonly conversions: number;
  readonly comparedDay: string;
  readonly comparedConversions: number;
}

export type ProjectAlert = NoEventsAlert | FailedWritesAlert | ConversionDropAlert;
