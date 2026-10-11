import { createHash } from 'node:crypto';

export const SITE_ICON_TYPES = [
  'image/png',
  'image/x-icon',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const;

export type SiteIconType = (typeof SITE_ICON_TYPES)[number];

export const MAX_SITE_PAGE_BYTES = 512 * 1024;
export const MAX_SITE_ICON_BYTES = 100 * 1024;
export const MAX_ICON_CANDIDATES = 4;

const VERSION_LENGTH = 16;
const FALLBACK_ICON_PATH = '/favicon.ico';
const SECURE_PROTOCOL = 'https:';
const LINK_TAG = /<link\b[^>]*>/gi;
const ATTRIBUTE = /([^\s=/>]+)\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+)/g;
const QUOTES = /^["']|["']$/g;
const QUERY_OR_FRAGMENT = /[?#].*$/;
const SIZE = /^(\d+)x\d+$/i;
const SVG = /svg/i;
const SVG_PATH = /\.svg$/i;
const APPLE_TOUCH_RELS: ReadonlySet<string> = new Set([
  'apple-touch-icon',
  'apple-touch-icon-precomposed',
]);
const ICON_REL = 'icon';

interface IconLink {
  readonly href: string;
  readonly appleTouch: boolean;
  readonly side: number;
}

function attributesOf(tag: string): ReadonlyMap<string, string> {
  const attributes = new Map<string, string>();
  for (const [, name, value] of tag.matchAll(ATTRIBUTE)) {
    attributes.set(String(name).toLowerCase(), String(value).replace(QUOTES, ''));
  }
  return attributes;
}

function largestSide(sizes: string): number {
  return sizes
    .split(/\s+/)
    .map((size) => SIZE.exec(size)?.[1])
    .reduce((largest, width) => Math.max(largest, width === undefined ? 0 : Number(width)), 0);
}

function iconLinkOf(tag: string): IconLink | null {
  const attributes = attributesOf(tag);
  const rels = (attributes.get('rel') ?? '').toLowerCase().split(/\s+/);
  const href = (attributes.get('href') ?? '').replaceAll('&amp;', '&').trim();
  const appleTouch = rels.some((rel) => APPLE_TOUCH_RELS.has(rel));
  if (href === '' || (!appleTouch && !rels.includes(ICON_REL))) {
    return null;
  }
  if (
    SVG.test(attributes.get('type') ?? '') ||
    SVG_PATH.test(href.replace(QUERY_OR_FRAGMENT, ''))
  ) {
    return null;
  }
  return { href, appleTouch, side: largestSide(attributes.get('sizes') ?? '') };
}

function byPreference(left: IconLink, right: IconLink): number {
  if (left.appleTouch !== right.appleTouch) {
    return left.appleTouch ? -1 : 1;
  }
  return right.side - left.side;
}

function secureAddress(href: string, base: string): string | null {
  if (!URL.canParse(href, base)) {
    return null;
  }
  const address = new URL(href, base);
  return address.protocol === SECURE_PROTOCOL ? address.href : null;
}

export function iconCandidates(html: string, pageUrl: string): readonly string[] {
  const declared = [...html.matchAll(LINK_TAG)]
    .map(([tag]) => iconLinkOf(tag))
    .filter((link): link is IconLink => link !== null)
    .sort(byPreference)
    .map((link) => secureAddress(link.href, pageUrl));
  const candidates = [...declared, secureAddress(FALLBACK_ICON_PATH, pageUrl)].filter(
    (address): address is string => address !== null,
  );
  return [...new Set(candidates)].slice(0, MAX_ICON_CANDIDATES);
}

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const ICO = [0x00, 0x00, 0x01, 0x00];
const JPEG = [0xff, 0xd8, 0xff];
const GIF = [0x47, 0x49, 0x46, 0x38];
const RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP = [0x57, 0x45, 0x42, 0x50];
const WEBP_MARK_OFFSET = 8;

export function sniffIconType(bytes: Uint8Array): SiteIconType | null {
  if (startsWith(bytes, PNG)) {
    return 'image/png';
  }
  if (startsWith(bytes, ICO)) {
    return 'image/x-icon';
  }
  if (startsWith(bytes, JPEG)) {
    return 'image/jpeg';
  }
  if (startsWith(bytes, GIF)) {
    return 'image/gif';
  }
  if (startsWith(bytes, RIFF) && startsWith(bytes, WEBP, WEBP_MARK_OFFSET)) {
    return 'image/webp';
  }
  return null;
}

export function iconVersion(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex').slice(0, VERSION_LENGTH);
}
