import type { PropertyMap } from '../entities/tracked-event.entity';

export const EXPORT_PAGE_SIZE = 1000;

export interface SubjectEvent {
  readonly id: string;
  readonly name: string;
  readonly occurredAt: Date;
  readonly sessionId: string;
  readonly path: string;
  readonly referrerHost: string | null;
  readonly utmSource: string | null;
  readonly utmMedium: string | null;
  readonly utmCampaign: string | null;
  readonly fromAdClick: boolean;
  readonly deviceType: string;
  readonly browser: string;
  readonly os: string;
  readonly country: string | null;
  readonly properties: PropertyMap;
}

export interface SubjectEventsRepository {
  erase(projectId: string, userId: string): Promise<number>;
  hasEvent(projectId: string, eventId: string): Promise<boolean>;
  page(
    projectId: string,
    userId: string,
    after: string | null,
    limit: number,
  ): Promise<readonly SubjectEvent[]>;
}

export const SUBJECT_EVENTS_REPOSITORY = Symbol('SubjectEventsRepository');

export interface SubjectEventsPage {
  readonly events: readonly SubjectEvent[];
  readonly nextAfter: string | null;
}
