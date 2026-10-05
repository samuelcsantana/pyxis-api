import type { TrackedEvent } from '../entities/tracked-event.entity';

export interface InsertedEvents {
  readonly inserted: number;
}

export interface EventRepository {
  insertMany(events: readonly TrackedEvent[]): Promise<InsertedEvents>;
}
