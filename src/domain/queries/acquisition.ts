import { CHANNELS, type Channel } from '../entities/tracked-event.entity';
import type { QueryScope } from './query-scope';

export const TOP_SOURCES = 20;
export const TOP_CAMPAIGNS = 20;
export const DIRECT_SOURCE = '(direct)';
export const AD_CLICK_SOURCE = '(ad click)';

export interface ChannelDayCount {
  readonly date: string;
  readonly channel: Channel;
  readonly visits: number;
}

export interface SourceCount {
  readonly source: string;
  readonly medium: string | null;
  readonly channel: Channel;
  readonly visits: number;
  readonly conversions: number;
  readonly convertingVisits: number;
  readonly fromAdClickVisits: number;
  readonly revenue: number;
}

export interface CampaignCount extends SourceCount {
  readonly campaign: string;
}

export type ChannelCount = Omit<SourceCount, 'source' | 'medium'>;

export interface AcquisitionQuery {
  visitsByDayAndChannel(scope: QueryScope): Promise<readonly ChannelDayCount[]>;
  sources(scope: QueryScope, limit: number): Promise<readonly SourceCount[]>;
  campaigns(scope: QueryScope, limit: number): Promise<readonly CampaignCount[]>;
  channels(scope: QueryScope): Promise<readonly ChannelCount[]>;
}

export const ACQUISITION_QUERY = Symbol('AcquisitionQuery');

export type ChannelVisits = Readonly<Record<Channel, number>>;

export interface DayChannels {
  readonly date: string;
  readonly byChannel: ChannelVisits;
}

type Counted = 'conversions' | 'convertingVisits' | 'revenue';

interface ConversionShare {
  readonly conversions: number | null;
  readonly convertingVisits: number | null;
  readonly revenue: number | null;
}

export interface SourceShare extends Omit<SourceCount, Counted>, ConversionShare {}

export interface ChannelShare extends Omit<ChannelCount, Counted>, ConversionShare {}

export interface CampaignShare extends SourceShare {
  readonly campaign: string;
}

export interface AcquisitionReport {
  readonly days: readonly DayChannels[];
  readonly sources: readonly SourceShare[];
  readonly campaigns: readonly CampaignShare[];
  readonly channels: readonly ChannelShare[];
}

export interface CountedConversions {
  readonly conversions: boolean;
  readonly revenue: boolean;
}

export function withConversionsWhenCounted<Count extends ChannelCount>(
  count: Count,
  counted: CountedConversions,
): Omit<Count, Counted> & ConversionShare {
  return {
    ...count,
    conversions: counted.conversions ? count.conversions : null,
    convertingVisits: counted.conversions ? count.convertingVisits : null,
    revenue: counted.revenue ? count.revenue : null,
  };
}

export function everyChannel(counts: readonly ChannelCount[]): readonly ChannelCount[] {
  return CHANNELS.map(
    (channel) =>
      counts.find((count) => count.channel === channel) ?? {
        channel,
        visits: 0,
        conversions: 0,
        convertingVisits: 0,
        fromAdClickVisits: 0,
        revenue: 0,
      },
  );
}

export function noChannelVisits(): ChannelVisits {
  return Object.fromEntries(CHANNELS.map((channel) => [channel, 0])) as Record<Channel, number>;
}

export function channelsPerDay(
  dates: readonly string[],
  counts: readonly ChannelDayCount[],
): readonly DayChannels[] {
  return dates.map((date) => ({
    date,
    byChannel: counts
      .filter((count) => count.date === date)
      .reduce<ChannelVisits>(
        (visits, count) => ({ ...visits, [count.channel]: visits[count.channel] + count.visits }),
        noChannelVisits(),
      ),
  }));
}
