import { CHANNELS, type Channel } from '../entities/tracked-event.entity';
import type { QueryScope } from './query-scope';

export const TOP_SOURCES = 20;
export const DIRECT_SOURCE = '(direct)';

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
  readonly fromAdClickVisits: number;
}

export interface AcquisitionQuery {
  visitsByDayAndChannel(scope: QueryScope): Promise<readonly ChannelDayCount[]>;
  sources(scope: QueryScope, limit: number): Promise<readonly SourceCount[]>;
}

export const ACQUISITION_QUERY = Symbol('AcquisitionQuery');

export type ChannelVisits = Readonly<Record<Channel, number>>;

export interface DayChannels {
  readonly date: string;
  readonly byChannel: ChannelVisits;
}

export interface SourceShare extends Omit<SourceCount, 'conversions'> {
  readonly conversions: number | null;
}

export interface AcquisitionReport {
  readonly days: readonly DayChannels[];
  readonly sources: readonly SourceShare[];
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
