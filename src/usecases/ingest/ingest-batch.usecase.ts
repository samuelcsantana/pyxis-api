import { Inject, Injectable } from '@nestjs/common';
import type { Project } from '../../domain/entities/project.entity';
import type { TrackedEvent } from '../../domain/entities/tracked-event.entity';
import {
  BatchTooLargeError,
  OriginNotAllowedError,
  ProjectRateLimitedError,
  UnknownProjectKeyError,
} from '../../domain/errors/ingest.errors';
import { buildTrackedEvent, type ReceptionContext } from '../../domain/events/build-tracked-event';
import { normalizeCountry } from '../../domain/events/country';
import { EVENT_NAME_PATTERN, MAX_EVENTS_PER_BATCH } from '../../domain/events/event-limits';
import type { PiiReason } from '../../domain/events/pii-barrier';
import {
  type ClientHints,
  classifyUserAgent,
  isBotUserAgent,
} from '../../domain/events/user-agent';
import {
  type EventRejectionReason,
  validateIncomingEvent,
} from '../../domain/events/validate-event';
import { EVENT_REPOSITORY, type EventRepository } from '../../domain/repositories/event.repository';
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
} from '../../domain/repositories/project.repository';
import { CLOCK, type Clock } from '../../domain/services/clock';
import {
  PROJECT_RATE_LIMITER,
  type ProjectRateLimiter,
} from '../../domain/services/project-rate-limiter';

export interface IngestBatchCommand {
  readonly key: string;
  readonly sentAt: Date;
  readonly events: readonly unknown[];
  readonly origin: string | undefined;
  readonly userAgent: string | undefined;
  readonly clientHints: ClientHints;
  readonly viewerCountry: string | undefined;
}

export interface EventRejection {
  readonly reason: EventRejectionReason | 'bot';
  readonly name: string | null;
}

export interface DroppedProperty {
  readonly eventName: string;
  readonly field: string;
  readonly reason: PiiReason;
}

export interface IngestBatchResult {
  readonly accepted: number;
  readonly duplicates: number;
  readonly rejected: number;
  readonly projectId: string;
  readonly allowedOrigin: string;
  readonly rejections: readonly EventRejection[];
  readonly dropped: readonly DroppedProperty[];
}

function eventNameOf(input: unknown): string | null {
  if (typeof input !== 'object' || input === null || !('name' in input)) {
    return null;
  }
  const { name } = input;
  return typeof name === 'string' && EVENT_NAME_PATTERN.test(name) ? name : null;
}

@Injectable()
export class IngestBatchUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
    @Inject(EVENT_REPOSITORY) private readonly events: EventRepository,
    @Inject(PROJECT_RATE_LIMITER) private readonly rateLimiter: ProjectRateLimiter,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: IngestBatchCommand): Promise<IngestBatchResult> {
    if (command.events.length > MAX_EVENTS_PER_BATCH) {
      throw new BatchTooLargeError();
    }
    const project = await this.projects.findByPublicKey(command.key);
    if (project === null) {
      throw new UnknownProjectKeyError();
    }
    const origin = this.allowedOrigin(project, command.origin);
    const receivedAt = this.clock.now();
    const decision = this.rateLimiter.tryConsume(project.id, receivedAt);
    if (!decision.allowed) {
      throw new ProjectRateLimitedError(decision.retryAfterSeconds, origin);
    }
    if (isBotUserAgent(command.userAgent)) {
      return {
        accepted: 0,
        duplicates: 0,
        rejected: command.events.length,
        projectId: project.id,
        allowedOrigin: origin,
        rejections: command.events.map(() => ({ reason: 'bot', name: null })),
        dropped: [],
      };
    }
    const context: ReceptionContext = {
      projectId: project.id,
      sentAt: command.sentAt,
      receivedAt,
      device: classifyUserAgent(command.userAgent, command.clientHints),
      country: normalizeCountry(command.viewerCountry),
    };
    return this.ingest(command.events, context, origin);
  }

  private allowedOrigin(project: Project, origin: string | undefined): string {
    if (origin === undefined || !project.allowedOrigins.includes(origin)) {
      throw new OriginNotAllowedError();
    }
    return origin;
  }

  private async ingest(
    events: readonly unknown[],
    context: ReceptionContext,
    origin: string,
  ): Promise<IngestBatchResult> {
    const tracked: TrackedEvent[] = [];
    const rejections: EventRejection[] = [];
    const dropped: DroppedProperty[] = [];
    for (const input of events) {
      const validation = validateIncomingEvent(input);
      if (!validation.ok) {
        rejections.push({ reason: validation.reason, name: eventNameOf(input) });
        continue;
      }
      tracked.push(buildTrackedEvent(validation.event, context));
      dropped.push(
        ...validation.dropped.map((field) => ({ eventName: validation.event.name, ...field })),
      );
    }
    const { inserted } =
      tracked.length === 0 ? { inserted: 0 } : await this.events.insertMany(tracked);
    return {
      accepted: inserted,
      duplicates: tracked.length - inserted,
      rejected: rejections.length,
      projectId: context.projectId,
      allowedOrigin: origin,
      rejections,
      dropped,
    };
  }
}
