import type { BrowserFamily, DeviceType, OsFamily } from '../entities/tracked-event.entity';

export interface ClientHints {
  readonly mobile?: string;
  readonly platform?: string;
}

export interface UserAgentClassification {
  readonly deviceType: DeviceType;
  readonly browser: BrowserFamily;
  readonly os: OsFamily;
}

type Rule<T> = readonly [RegExp, T];

const BROWSER_RULES: readonly Rule<BrowserFamily>[] = [
  [/SamsungBrowser\//, 'samsung'],
  [/Edg(e|A|iOS)?\//, 'edge'],
  [/OPR\/|OPiOS\/|Opera/, 'opera'],
  [/Firefox\/|FxiOS\//, 'firefox'],
  [/Chrome\/|CriOS\/|Chromium\//, 'chrome'],
  [/Version\/[\d.]+.*Safari\//, 'safari'],
];

const OS_RULES: readonly Rule<OsFamily>[] = [
  [/Android/, 'android'],
  [/iPhone|iPad|iPod/, 'ios'],
  [/Windows/, 'windows'],
  [/CrOS/, 'chromeos'],
  [/Macintosh|Mac OS X/, 'macos'],
  [/Linux/, 'linux'],
];

const PLATFORM_HINTS: ReadonlyMap<string, OsFamily> = new Map<string, OsFamily>([
  ['Android', 'android'],
  ['iOS', 'ios'],
  ['Windows', 'windows'],
  ['macOS', 'macos'],
  ['Linux', 'linux'],
  ['Chrome OS', 'chromeos'],
  ['ChromeOS', 'chromeos'],
]);

const SURROUNDING_QUOTES = /^"|"$/g;
const MOBILE_HINT = '?1';
const TABLET_PATTERN = /iPad|Tablet/;
const PHONE_PATTERN = /Mobi|iPhone|iPod/;
const DESKTOP_SYSTEMS: ReadonlySet<OsFamily> = new Set<OsFamily>([
  'windows',
  'macos',
  'linux',
  'chromeos',
]);
const BOT_MARKERS = ['bot', 'crawler', 'spider', 'headless', 'lighthouse'] as const;

function firstMatch<T>(rules: readonly Rule<T>[], userAgent: string, fallback: T): T {
  return rules.find(([pattern]) => pattern.test(userAgent))?.[1] ?? fallback;
}

function osFrom(userAgent: string, platformHint: string | undefined): OsFamily {
  const hinted =
    platformHint === undefined
      ? undefined
      : PLATFORM_HINTS.get(platformHint.replace(SURROUNDING_QUOTES, ''));
  return hinted ?? firstMatch(OS_RULES, userAgent, 'other');
}

function deviceFrom(userAgent: string, os: OsFamily, mobileHint: string | undefined): DeviceType {
  if (mobileHint === MOBILE_HINT || PHONE_PATTERN.test(userAgent)) {
    return TABLET_PATTERN.test(userAgent) ? 'tablet' : 'mobile';
  }
  if (TABLET_PATTERN.test(userAgent) || os === 'android') {
    return 'tablet';
  }
  return DESKTOP_SYSTEMS.has(os) ? 'desktop' : 'other';
}

export function classifyUserAgent(
  userAgent: string | undefined,
  hints: ClientHints,
): UserAgentClassification {
  const text = userAgent ?? '';
  const os = osFrom(text, hints.platform);
  return {
    deviceType: deviceFrom(text, os, hints.mobile),
    browser: firstMatch(BROWSER_RULES, text, 'other'),
    os,
  };
}

export function isBotUserAgent(userAgent: string | undefined): boolean {
  const lowerCased = userAgent?.toLowerCase() ?? '';
  return BOT_MARKERS.some((marker) => lowerCased.includes(marker));
}
