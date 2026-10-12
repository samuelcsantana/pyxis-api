export const REGION_CODE_PATTERN = /^[A-Z]{2}-[A-Z0-9]{1,3}$/;
export const MAX_REGION_NAME_LENGTH = 64;

const SUBDIVISION_PATTERN = /^[A-Z0-9]{1,3}$/;
const PRINTABLE_ASCII = /^[\x20-\x7E]*$/;
const STRAY_PERCENT = /%(?![0-9A-Fa-f]{2})/;
const PERCENT_ESCAPE = /%([0-9A-Fa-f]{2})/g;
const CONTROL_CHARACTER = /\p{Cc}/u;
const REPLACEMENT_CHARACTER = '\uFFFD';
const HEXADECIMAL = 16;

export interface ViewerRegion {
  readonly region: string | null;
  readonly regionName: string | null;
}

export const UNKNOWN_REGION: ViewerRegion = { region: null, regionName: null };

export function normalizeRegion(
  country: string | null,
  viewerRegion: string | undefined,
  viewerRegionName: string | undefined,
): ViewerRegion {
  if (country === null || viewerRegion === undefined || !SUBDIVISION_PATTERN.test(viewerRegion)) {
    return UNKNOWN_REGION;
  }
  return {
    region: `${country}-${viewerRegion}`,
    regionName: viewerRegionName === undefined ? null : normalizeRegionName(viewerRegionName),
  };
}

function normalizeRegionName(encoded: string): string | null {
  const decoded = decodePercentEncoding(encoded);
  if (decoded === null) {
    return null;
  }
  const name = decoded.trim();
  const acceptable =
    name.length > 0 && name.length <= MAX_REGION_NAME_LENGTH && !CONTROL_CHARACTER.test(name);
  return acceptable ? name : null;
}

function decodePercentEncoding(encoded: string): string | null {
  if (!PRINTABLE_ASCII.test(encoded) || STRAY_PERCENT.test(encoded)) {
    return null;
  }
  const latin1 = encoded.replace(PERCENT_ESCAPE, (_escape, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, HEXADECIMAL)),
  );
  const bytes = Uint8Array.from(latin1, (character) => character.charCodeAt(0));
  const decoded = new TextDecoder().decode(bytes);
  return decoded.includes(REPLACEMENT_CHARACTER) ? null : decoded;
}
