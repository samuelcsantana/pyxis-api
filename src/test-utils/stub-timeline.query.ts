import type {
  TimelineEvent,
  TimelineQuery,
  TimelineSubject,
  VisitSummary,
} from '../domain/queries/timeline';

export class StubTimelineQuery implements TimelineQuery {
  readonly visitCalls: {
    readonly projectId: string;
    readonly subject: TimelineSubject;
    readonly before: Date | null;
    readonly limit: number;
  }[] = [];
  readonly eventCalls: { readonly projectId: string; readonly sessionIds: readonly string[] }[] =
    [];
  summaries: readonly VisitSummary[] = [];
  timelineEvents: readonly TimelineEvent[] = [];

  visits(
    projectId: string,
    subject: TimelineSubject,
    before: Date | null,
    limit: number,
  ): Promise<readonly VisitSummary[]> {
    this.visitCalls.push({ projectId, subject, before, limit });
    return Promise.resolve(this.summaries);
  }

  events(projectId: string, sessionIds: readonly string[]): Promise<readonly TimelineEvent[]> {
    this.eventCalls.push({ projectId, sessionIds });
    return Promise.resolve(this.timelineEvents);
  }
}
