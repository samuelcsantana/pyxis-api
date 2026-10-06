export type PropertyValue = string | number | boolean;

export type PropertyMap = Readonly<Record<string, PropertyValue>>;

export type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'other';

export type BrowserFamily =
  'chrome' | 'safari' | 'firefox' | 'edge' | 'samsung' | 'opera' | 'other';

export type OsFamily = 'android' | 'ios' | 'windows' | 'macos' | 'linux' | 'chromeos' | 'other';

export const CHANNELS = [
  'paid',
  'email',
  'social',
  'campaign',
  'organic',
  'referral',
  'direct',
] as const;

export type Channel = (typeof CHANNELS)[number];

export interface Attribution {
  readonly referrerHost: string | null;
  readonly utmSource: string | null;
  readonly utmMedium: string | null;
  readonly utmCampaign: string | null;
  readonly fromAdClick: boolean;
}

export interface TrackedEvent {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly occurredAt: Date;
  readonly receivedAt: Date;
  readonly sessionId: string;
  readonly userId: string | null;
  readonly path: string;
  readonly attribution: Attribution | null;
  readonly channel: Channel | null;
  readonly deviceType: DeviceType;
  readonly browser: BrowserFamily;
  readonly os: OsFamily;
  readonly country: string | null;
  readonly properties: PropertyMap;
}
