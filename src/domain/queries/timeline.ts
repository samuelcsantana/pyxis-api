import type { Channel, PropertyMap } from '../entities/tracked-event.entity';

export const VISITS_PER_PAGE = 20;

export type TimelineSubject =
  | { readonly userId: string; readonly sessionId?: never }
  | { readonly sessionId: string; readonly userId?: never };

export interface VisitSummary {
  readonly sessionId: string;
  readonly startedAt: Date;
  readonly endedAt: Date;
  readonly deviceType: string;
  readonly browser: string;
  readonly os: string;
  readonly country: string | null;
  readonly channel: Channel | null;
}

export interface TimelineEvent {
  readonly id: string;
  readonly sessionId: string;
  readonly occurredAt: Date;
  readonly name: string;
  readonly path: string;
  readonly properties: PropertyMap;
}

export interface TimelineQuery {
  visits(
    projectId: string,
    subject: TimelineSubject,
    before: Date | null,
    limit: number,
  ): Promise<readonly VisitSummary[]>;
  events(projectId: string, sessionIds: readonly string[]): Promise<readonly TimelineEvent[]>;
}

export const TIMELINE_QUERY = Symbol('TimelineQuery');

export interface TimelineVisit extends VisitSummary {
  readonly events: readonly Omit<TimelineEvent, 'sessionId'>[];
}

export interface TimelineReport {
  readonly visits: readonly TimelineVisit[];
  readonly nextBefore: Date | null;
}

export function timelinePage(
  summaries: readonly VisitSummary[],
  events: readonly TimelineEvent[],
  pageSize: number,
): TimelineReport {
  const page = summaries.slice(0, pageSize);
  const [oldestShown] = summaries.length > pageSize ? page.slice(-1) : [];
  return {
    visits: page.map((visit) => ({
      ...visit,
      events: events
        .filter((event) => event.sessionId === visit.sessionId)
        .map((event) => ({
          id: event.id,
          occurredAt: event.occurredAt,
          name: event.name,
          path: event.path,
          properties: event.properties,
        })),
    })),
    nextBefore: oldestShown?.startedAt ?? null,
  };
}
