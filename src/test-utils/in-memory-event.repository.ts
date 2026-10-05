import type { TrackedEvent } from '../domain/entities/tracked-event.entity';
import type { EventRepository, InsertedEvents } from '../domain/repositories/event.repository';

export class InMemoryEventRepository implements EventRepository {
  private readonly rows = new Map<string, TrackedEvent>();
  insertCalls = 0;

  get stored(): readonly TrackedEvent[] {
    return [...this.rows.values()];
  }

  insertMany(events: readonly TrackedEvent[]): Promise<InsertedEvents> {
    this.insertCalls += 1;
    let inserted = 0;
    for (const event of events) {
      const rowKey = `${event.projectId}:${event.id}`;
      if (!this.rows.has(rowKey)) {
        this.rows.set(rowKey, event);
        inserted += 1;
      }
    }
    return Promise.resolve({ inserted });
  }
}
