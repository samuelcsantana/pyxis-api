import { Inject, Injectable } from '@nestjs/common';
import type { TrackedEvent } from '../../domain/entities/tracked-event.entity';
import type { EventRepository, InsertedEvents } from '../../domain/repositories/event.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { events, type NewEventRow } from '../database/schema/events';

export function toEventRow(event: TrackedEvent): NewEventRow {
  return {
    id: event.id,
    projectId: event.projectId,
    occurredAt: event.occurredAt,
    receivedAt: event.receivedAt,
    name: event.name,
    sessionId: event.sessionId,
    userId: event.userId,
    path: event.path,
    referrerHost: event.attribution?.referrerHost ?? null,
    utmSource: event.attribution?.utmSource ?? null,
    utmMedium: event.attribution?.utmMedium ?? null,
    utmCampaign: event.attribution?.utmCampaign ?? null,
    fromAdClick: event.attribution?.fromAdClick ?? false,
    deviceType: event.deviceType,
    browser: event.browser,
    os: event.os,
    country: event.country,
    channel: event.channel,
    properties: event.properties,
  };
}

@Injectable()
export class DrizzleEventRepository implements EventRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async insertMany(trackedEvents: readonly TrackedEvent[]): Promise<InsertedEvents> {
    if (trackedEvents.length === 0) {
      return { inserted: 0 };
    }
    const inserted = await this.db
      .insert(events)
      .values(trackedEvents.map(toEventRow))
      .onConflictDoNothing({ target: [events.projectId, events.id] })
      .returning({ id: events.id });
    return { inserted: inserted.length };
  }
}
