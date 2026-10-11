import type { Attribution, Channel } from '../entities/tracked-event.entity';

const PAID_MEDIUMS: ReadonlySet<string> = new Set([
  'cpc',
  'ppc',
  'paid',
  'paidsearch',
  'paid_social',
  'display',
]);
const EMAIL_MEDIUMS: ReadonlySet<string> = new Set(['email', 'e-mail', 'newsletter']);
const SOCIAL_MEDIUMS: ReadonlySet<string> = new Set([
  'social',
  'social-network',
  'social-media',
  'social_media',
  'sm',
]);
const SOCIAL_DOMAINS = [
  'facebook.com',
  'instagram.com',
  'threads.net',
  'x.com',
  'twitter.com',
  't.co',
  'linkedin.com',
  'lnkd.in',
  'reddit.com',
  'youtube.com',
  'tiktok.com',
  'pinterest.com',
  'whatsapp.com',
  'wa.me',
] as const;
const SOCIAL_SOURCES: ReadonlySet<string> = new Set([
  'facebook',
  'fb',
  'instagram',
  'ig',
  'threads',
  'x',
  'twitter',
  'linkedin',
  'reddit',
  'youtube',
  'tiktok',
  'pinterest',
  'whatsapp',
]);
const SEARCH_ENGINE_HOSTS: readonly RegExp[] = [
  /^google(\.[a-z]{2,3}){1,2}$/,
  /^bing\.com$/,
  /^duckduckgo\.com$/,
  /^([a-z]{2}\.)?search\.yahoo\.com$/,
  /^yandex(\.[a-z]{2,3}){1,2}$/,
  /^baidu\.com$/,
  /^ecosia\.org$/,
  /^search\.brave\.com$/,
  /^startpage\.com$/,
  /^qwant\.com$/,
];
const WWW_PREFIX = /^www\./;

function hasUtm(attribution: Attribution): boolean {
  return (
    attribution.utmSource !== null ||
    attribution.utmMedium !== null ||
    attribution.utmCampaign !== null
  );
}

function belongsTo(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

function isSocialHost(host: string): boolean {
  const bare = host.replace(WWW_PREFIX, '');
  return SOCIAL_DOMAINS.some((domain) => belongsTo(bare, domain));
}

function isSocialSource(source: string | undefined): boolean {
  return source !== undefined && (SOCIAL_SOURCES.has(source) || isSocialHost(source));
}

function channelFromTags(medium: string | undefined, source: string | undefined): Channel {
  if (medium !== undefined && EMAIL_MEDIUMS.has(medium)) {
    return 'email';
  }
  if ((medium !== undefined && SOCIAL_MEDIUMS.has(medium)) || isSocialSource(source)) {
    return 'social';
  }
  return 'campaign';
}

function channelFromReferrer(referrerHost: string | null): Channel {
  if (referrerHost === null) {
    return 'direct';
  }
  const host = referrerHost.replace(WWW_PREFIX, '');
  if (isSocialHost(host)) {
    return 'social';
  }
  if (SEARCH_ENGINE_HOSTS.some((pattern) => pattern.test(host))) {
    return 'organic';
  }
  return 'referral';
}

export function classifyChannel(attribution: Attribution): Channel {
  const medium = attribution.utmMedium?.toLowerCase();
  if (attribution.fromAdClick || (medium !== undefined && PAID_MEDIUMS.has(medium))) {
    return 'paid';
  }
  if (hasUtm(attribution)) {
    return channelFromTags(medium, attribution.utmSource?.toLowerCase());
  }
  return channelFromReferrer(attribution.referrerHost);
}
