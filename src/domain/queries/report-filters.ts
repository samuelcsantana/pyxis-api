import type { Channel, DeviceType } from '../entities/tracked-event.entity';

export const MAX_VISIT_PATH_FILTERS = 3;

export const VISIT_IDENTITIES = ['identified', 'anonymous'] as const;
export type VisitIdentity = (typeof VISIT_IDENTITIES)[number];

export interface VisitPropertyFilter {
  readonly key: string;
  readonly value: string;
}

export interface VisitEventFilter {
  readonly name: string;
  readonly property: VisitPropertyFilter | null;
}

export interface ReportFilters {
  readonly paths: readonly string[];
  readonly event: VisitEventFilter | null;
  readonly channel: Channel | null;
  readonly deviceType: DeviceType | null;
  readonly identity: VisitIdentity | null;
  readonly country: string | null;
  readonly region: string | null;
  readonly source: string | null;
  readonly campaign: string | null;
  readonly failed: boolean;
}

export const NO_REPORT_FILTERS: ReportFilters = {
  paths: [],
  event: null,
  channel: null,
  deviceType: null,
  identity: null,
  country: null,
  region: null,
  source: null,
  campaign: null,
  failed: false,
};
