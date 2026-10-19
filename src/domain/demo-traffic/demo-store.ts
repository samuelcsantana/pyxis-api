import type {
  Attribution,
  BrowserFamily,
  DeviceType,
  OsFamily,
} from '../entities/tracked-event.entity';
import type { Weighted } from './seeded-random';

export interface DemoDevice {
  readonly deviceType: DeviceType;
  readonly browser: BrowserFamily;
  readonly os: OsFamily;
}

export interface DemoPlace {
  readonly country: string;
  readonly region: string;
  readonly regionName: string;
}

export interface DemoRequestOutcome {
  readonly status: number;
  readonly errorCode: string | null;
}

export const DEMO_CONVERSION_EVENT = 'signup_completed';
export const DEMO_PEOPLE = 300;
export const DEMO_LOYAL_PEOPLE = 40;
export const DEMO_VISITS_BY_WEEKDAY = [48, 52, 54, 50, 45, 33, 30] as const;
export const DEMO_DAILY_VARIATION = 0.3;
export const DEMO_CATEGORIES = ['shoes', 'bags', 'hats', 'socks'] as const;
export const DEMO_PAYMENT_METHODS = ['card', 'paypal', 'pix'] as const;
export const DEMO_PLANS = ['free', 'pro'] as const;
export const DEMO_BLOG_PATHS = ['/blog/choosing-running-shoes', '/blog/fall-collection'] as const;
export const DEMO_FAILED_READ_CHANCE = 0.03;
export const DEMO_ORDER_RETRY_CHANCE = 0.5;
export const DEMO_SEARCH_CHANCE = 0.35;
export const DEMO_PRICING_EXIT_CHANCE = 0.3;
export const DEMO_SIGN_UP_PAGE_EXIT_CHANCE = 0.15;

const HOURLY_WEIGHTS = [2, 1, 1, 1, 1, 2, 3, 5, 7, 9, 10, 10, 9, 8, 8, 8, 8, 8, 9, 10, 10, 8, 5, 3];

export const DEMO_VISITS_BY_HOUR: readonly Weighted<number>[] = HOURLY_WEIGHTS.map(
  (weight, hour) => ({ item: hour, weight }),
);

export const DEMO_DEVICES: readonly Weighted<DemoDevice>[] = [
  { item: { deviceType: 'mobile', browser: 'chrome', os: 'android' }, weight: 30 },
  { item: { deviceType: 'mobile', browser: 'safari', os: 'ios' }, weight: 25 },
  { item: { deviceType: 'desktop', browser: 'chrome', os: 'windows' }, weight: 20 },
  { item: { deviceType: 'desktop', browser: 'safari', os: 'macos' }, weight: 10 },
  { item: { deviceType: 'desktop', browser: 'edge', os: 'windows' }, weight: 6 },
  { item: { deviceType: 'tablet', browser: 'safari', os: 'ios' }, weight: 4 },
  { item: { deviceType: 'desktop', browser: 'firefox', os: 'linux' }, weight: 3 },
  { item: { deviceType: 'mobile', browser: 'samsung', os: 'android' }, weight: 2 },
];

export const DEMO_PLACES: readonly Weighted<DemoPlace>[] = [
  { item: { country: 'US', region: 'US-CA', regionName: 'California' }, weight: 14 },
  { item: { country: 'BR', region: 'BR-SP', regionName: 'São Paulo' }, weight: 12 },
  { item: { country: 'US', region: 'US-NY', regionName: 'New York' }, weight: 10 },
  { item: { country: 'GB', region: 'GB-ENG', regionName: 'England' }, weight: 9 },
  { item: { country: 'US', region: 'US-TX', regionName: 'Texas' }, weight: 7 },
  { item: { country: 'BR', region: 'BR-RJ', regionName: 'Rio de Janeiro' }, weight: 5 },
  { item: { country: 'FR', region: 'FR-IDF', regionName: 'Île-de-France' }, weight: 5 },
  { item: { country: 'CA', region: 'CA-ON', regionName: 'Ontario' }, weight: 5 },
  { item: { country: 'US', region: 'US-WA', regionName: 'Washington' }, weight: 4 },
  { item: { country: 'DE', region: 'DE-BE', regionName: 'Berlin' }, weight: 4 },
  { item: { country: 'IN', region: 'IN-KA', regionName: 'Karnataka' }, weight: 4 },
  { item: { country: 'DE', region: 'DE-BY', regionName: 'Bavaria' }, weight: 3 },
  { item: { country: 'PT', region: 'PT-11', regionName: 'Lisbon' }, weight: 3 },
  { item: { country: 'ES', region: 'ES-MD', regionName: 'Madrid' }, weight: 3 },
  { item: { country: 'NL', region: 'NL-NH', regionName: 'North Holland' }, weight: 3 },
  { item: { country: 'AU', region: 'AU-NSW', regionName: 'New South Wales' }, weight: 3 },
];

function source(
  referrerHost: string | null,
  tags: Partial<Omit<Attribution, 'referrerHost'>> = {},
): Attribution {
  return {
    referrerHost,
    utmSource: tags.utmSource ?? null,
    utmMedium: tags.utmMedium ?? null,
    utmCampaign: tags.utmCampaign ?? null,
    fromAdClick: tags.fromAdClick ?? false,
  };
}

export const DEMO_SOURCES: readonly Weighted<Attribution>[] = [
  { item: source(null), weight: 28 },
  { item: source('google.com'), weight: 24 },
  {
    item: source('google.com', {
      utmSource: 'google',
      utmMedium: 'cpc',
      utmCampaign: 'fall-sale',
      fromAdClick: true,
    }),
    weight: 9,
  },
  { item: source('instagram.com'), weight: 6 },
  {
    item: source(null, {
      utmSource: 'newsletter',
      utmMedium: 'email',
      utmCampaign: 'october-digest',
    }),
    weight: 6,
  },
  {
    item: source('instagram.com', {
      utmSource: 'instagram',
      utmMedium: 'paid_social',
      utmCampaign: 'new-arrivals',
    }),
    weight: 4,
  },
  { item: source('bing.com'), weight: 3 },
  { item: source('linkedin.com'), weight: 3 },
  { item: source('news.ycombinator.com'), weight: 3 },
  {
    item: source(null, {
      utmSource: 'partner',
      utmMedium: 'affiliate',
      utmCampaign: 'creator-codes',
    }),
    weight: 3,
  },
  { item: source('duckduckgo.com'), weight: 2 },
  { item: source('t.co'), weight: 2 },
  { item: source('producthunt.com'), weight: 2 },
];

export const DEMO_CART_OUTCOMES: readonly Weighted<DemoRequestOutcome>[] = [
  { item: { status: 201, errorCode: null }, weight: 97 },
  { item: { status: 500, errorCode: null }, weight: 2 },
  { item: { status: 503, errorCode: null }, weight: 1 },
];

export const DEMO_ORDER_OUTCOMES: readonly Weighted<DemoRequestOutcome>[] = [
  { item: { status: 201, errorCode: null }, weight: 90 },
  { item: { status: 402, errorCode: 'card_declined' }, weight: 6 },
  { item: { status: 409, errorCode: 'out_of_stock' }, weight: 3 },
  { item: { status: 500, errorCode: null }, weight: 1 },
];

export const DEMO_SIGN_UP_OUTCOMES: readonly Weighted<DemoRequestOutcome>[] = [
  { item: { status: 201, errorCode: null }, weight: 92 },
  { item: { status: 400, errorCode: 'email_taken' }, weight: 6 },
  { item: { status: 429, errorCode: 'too_many_attempts' }, weight: 2 },
];

export const DEMO_SIGN_IN_OUTCOMES: readonly Weighted<DemoRequestOutcome>[] = [
  { item: { status: 200, errorCode: null }, weight: 93 },
  { item: { status: 401, errorCode: 'invalid_code' }, weight: 7 },
];

export const DEMO_FAILED_READS: readonly Weighted<DemoRequestOutcome>[] = [
  { item: { status: 503, errorCode: null }, weight: 2 },
  { item: { status: 500, errorCode: null }, weight: 1 },
];
