import { eventsPerMonthOf, ingestionPauseThresholdOf } from './account-limits';
import { type AccountMonthUsage, isPauseExemptAt } from './account-quota';

export const QUOTA_WARNING_PERCENTS = [80, 100] as const;
export const QUOTA_PAUSED_LEVEL = 150;
export const NOT_NOTIFIED = 0;

export type QuotaWarningPercent = (typeof QUOTA_WARNING_PERCENTS)[number];
export type QuotaNoticeLevel =
  typeof NOT_NOTIFIED | QuotaWarningPercent | typeof QUOTA_PAUSED_LEVEL;

export interface QuotaFigures {
  readonly events: number;
  readonly limit: number;
  readonly month: string;
  readonly measuredAt: Date;
}

export interface QuotaPause {
  readonly atEvents: number;
  readonly until: Date;
}

export type QuotaNotice =
  | (QuotaFigures & {
      readonly kind: 'quota_warning';
      readonly percent: QuotaWarningPercent;
      readonly pause: QuotaPause | null;
    })
  | (QuotaFigures & { readonly kind: 'quota_paused'; readonly resumesAt: Date });

const PERCENT = 100;

function eventsAt(eventsPerMonth: number, percent: number): number {
  return Math.ceil((eventsPerMonth * percent) / PERCENT);
}

export function quotaLevelOf(
  events: number,
  eventsPerMonth: number,
  pauseAtEvents: number,
): QuotaNoticeLevel {
  if (events >= pauseAtEvents) {
    return QUOTA_PAUSED_LEVEL;
  }
  const [warning, full] = QUOTA_WARNING_PERCENTS;
  if (events >= eventsAt(eventsPerMonth, full)) {
    return full;
  }
  return events >= eventsAt(eventsPerMonth, warning) ? warning : NOT_NOTIFIED;
}

export interface QuotaNoticeContext {
  readonly notifiedLevel: number;
  readonly month: string;
  readonly measuredAt: Date;
  readonly monthEnd: Date;
}

export interface DueQuotaNotice {
  readonly level: QuotaNoticeLevel;
  readonly notice: QuotaNotice;
}

export function quotaNoticeDue(
  usage: AccountMonthUsage,
  context: QuotaNoticeContext,
): DueQuotaNotice | null {
  if (usage.status === 'comped') {
    return null;
  }
  const exempt = isPauseExemptAt(usage.pauseExemptUntil, context.measuredAt);
  const eventsPerMonth = eventsPerMonthOf(usage);
  const pauseAtEvents = ingestionPauseThresholdOf(usage);
  const reached = quotaLevelOf(usage.events, eventsPerMonth, pauseAtEvents);
  const level = exempt && reached === QUOTA_PAUSED_LEVEL ? QUOTA_WARNING_PERCENTS[1] : reached;
  if (level === NOT_NOTIFIED || level <= context.notifiedLevel) {
    return null;
  }
  const figures: QuotaFigures = {
    events: usage.events,
    limit: eventsPerMonth,
    month: context.month,
    measuredAt: context.measuredAt,
  };
  if (level === QUOTA_PAUSED_LEVEL) {
    return { level, notice: { ...figures, kind: 'quota_paused', resumesAt: context.monthEnd } };
  }
  return {
    level,
    notice: {
      ...figures,
      kind: 'quota_warning',
      percent: level,
      pause: exempt ? null : { atEvents: pauseAtEvents, until: context.monthEnd },
    },
  };
}
