import { IDENTIFY } from '../domain/events/reserved-event-names';
import type { SubjectEvent, SubjectEventsRepository } from '../domain/subjects/subject-events';

export interface StoredSubjectEvent extends SubjectEvent {
  readonly projectId: string;
  readonly userId: string | null;
}

export class InMemorySubjectEventsRepository implements SubjectEventsRepository {
  private stored: StoredSubjectEvent[] = [];

  add(...events: readonly StoredSubjectEvent[]): void {
    this.stored.push(...events);
  }

  get remaining(): readonly StoredSubjectEvent[] {
    return this.stored;
  }

  erase(projectId: string, userId: string): Promise<number> {
    const subject = this.subjectEvents(projectId, userId);
    this.stored = this.stored.filter((event) => !subject.includes(event));
    return Promise.resolve(subject.length);
  }

  hasEvent(projectId: string, eventId: string): Promise<boolean> {
    return Promise.resolve(
      this.stored.some((event) => event.projectId === projectId && event.id === eventId),
    );
  }

  page(
    projectId: string,
    userId: string,
    after: string | null,
    limit: number,
  ): Promise<readonly SubjectEvent[]> {
    const ordered = this.subjectEvents(projectId, userId).toSorted(
      (left, right) =>
        left.occurredAt.getTime() - right.occurredAt.getTime() || left.id.localeCompare(right.id),
    );
    const start = after === null ? 0 : ordered.findIndex((event) => event.id === after) + 1;
    return Promise.resolve(ordered.slice(start, start + limit));
  }

  private subjectEvents(projectId: string, userId: string): StoredSubjectEvent[] {
    const linked = new Set(
      this.stored
        .filter(
          (event) =>
            event.projectId === projectId && event.userId === userId && event.name === IDENTIFY,
        )
        .map((event) => event.sessionId),
    );
    return this.stored.filter(
      (event) =>
        event.projectId === projectId && (event.userId === userId || linked.has(event.sessionId)),
    );
  }
}
