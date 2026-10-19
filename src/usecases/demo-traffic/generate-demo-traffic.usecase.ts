import { Inject, Injectable } from '@nestjs/common';
import { demoEventsOfDay } from '../../domain/demo-traffic/demo-day';
import type { TrackedEvent } from '../../domain/entities/tracked-event.entity';
import { daysIn, shiftDays, todayIn } from '../../domain/queries/date-range';
import {
  DEMO_TRAFFIC_REPOSITORY,
  type DemoTrafficRepository,
  type DemoTrafficTarget,
} from '../../domain/repositories/demo-traffic.repository';
import { EVENT_REPOSITORY, type EventRepository } from '../../domain/repositories/event.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';

export const DEMO_TRAFFIC_BACKFILL_DAYS = 90;
export const DEMO_TRAFFIC_INSERT_BATCH = 1000;

export interface DemoTrafficReport {
  readonly projects: number;
  readonly inserted: number;
}

function laterDay(left: string, right: string): string {
  return left > right ? left : right;
}

function firstDayToFill(target: DemoTrafficTarget, today: string): string {
  const earliest = shiftDays(today, -DEMO_TRAFFIC_BACKFILL_DAYS);
  if (target.lastEventAt === null) {
    return earliest;
  }
  const lastDay = todayIn(target.timezone, target.lastEventAt);
  return lastDay > today ? today : laterDay(lastDay, earliest);
}

function batches(events: readonly TrackedEvent[]): readonly (readonly TrackedEvent[])[] {
  return Array.from({ length: Math.ceil(events.length / DEMO_TRAFFIC_INSERT_BATCH) }, (_, index) =>
    events.slice(index * DEMO_TRAFFIC_INSERT_BATCH, (index + 1) * DEMO_TRAFFIC_INSERT_BATCH),
  );
}

@Injectable()
export class GenerateDemoTrafficUseCase {
  constructor(
    @Inject(DEMO_TRAFFIC_REPOSITORY) private readonly projects: DemoTrafficRepository,
    @Inject(EVENT_REPOSITORY) private readonly events: EventRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(): Promise<DemoTrafficReport> {
    const now = this.clock.now();
    const targets = await this.projects.targets();
    let inserted = 0;
    for (const target of targets) {
      inserted += await this.fill(target, now);
    }
    return { projects: targets.length, inserted };
  }

  private async fill(target: DemoTrafficTarget, now: Date): Promise<number> {
    const today = todayIn(target.timezone, now);
    const due = daysIn({ from: firstDayToFill(target, today), to: today }).flatMap((day) =>
      demoEventsOfDay(target.projectId, day, target.timezone).filter(
        (event) => event.receivedAt <= now,
      ),
    );
    let inserted = 0;
    for (const batch of batches(due)) {
      inserted += (await this.events.insertMany(batch)).inserted;
    }
    return inserted;
  }
}
