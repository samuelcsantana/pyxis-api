import { decodeHeaderName } from './header-name';

export const REGION_CODE_PATTERN = /^[A-Z]{2}-[A-Z0-9]{1,3}$/;
export const MAX_REGION_NAME_LENGTH = 64;

const SUBDIVISION_PATTERN = /^[A-Z0-9]{1,3}$/;

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
    regionName:
      viewerRegionName === undefined
        ? null
        : decodeHeaderName(viewerRegionName, MAX_REGION_NAME_LENGTH),
  };
}
