import type { PropertyMap } from '../entities/tracked-event.entity';

export interface ExportedEvent {
  readonly id: string;
  readonly occurredAt: Date;
  readonly name: string;
  readonly path: string;
  readonly sessionId: string;
  readonly userId: string | null;
  readonly referrerHost: string | null;
  readonly utmSource: string | null;
  readonly utmMedium: string | null;
  readonly utmCampaign: string | null;
  readonly fromAdClick: boolean;
  readonly channel: string | null;
  readonly deviceType: string;
  readonly browser: string;
  readonly os: string;
  readonly country: string | null;
  readonly region: string | null;
  readonly regionName: string | null;
  readonly properties: PropertyMap;
}

export interface ExportCursor {
  readonly occurredAt: Date;
  readonly id: string;
}
