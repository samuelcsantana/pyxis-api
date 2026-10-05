import type { TrackedEvent } from '../entities/tracked-event.entity';
import { classifyChannel } from './channel';
import { correctOccurredAt } from './occurred-at';
import type { UserAgentClassification } from './user-agent';
import type { AcceptedEvent } from './validate-event';

export interface ReceptionContext {
  readonly projectId: string;
  readonly sentAt: Date;
  readonly receivedAt: Date;
  readonly device: UserAgentClassification;
  readonly country: string | null;
}

export function buildTrackedEvent(event: AcceptedEvent, context: ReceptionContext): TrackedEvent {
  return {
    id: event.id,
    projectId: context.projectId,
    name: event.name,
    occurredAt: correctOccurredAt(event.occurredAt, context.sentAt, context.receivedAt),
    receivedAt: context.receivedAt,
    sessionId: event.sessionId,
    userId: event.userId,
    path: event.path,
    attribution: event.attribution,
    channel: event.attribution === null ? null : classifyChannel(event.attribution),
    deviceType: context.device.deviceType,
    browser: context.device.browser,
    os: context.device.os,
    country: context.country,
    properties: event.properties,
  };
}
