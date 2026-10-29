import { decodeHeaderName } from './header-name';
import type { ViewerRegion } from './region';

export const MAX_CITY_NAME_LENGTH = 100;

export function normalizeCity(
  cityEnabled: boolean,
  region: ViewerRegion,
  viewerCity: string | undefined,
): string | null {
  if (!cityEnabled || region.region === null || viewerCity === undefined) {
    return null;
  }
  return decodeHeaderName(viewerCity, MAX_CITY_NAME_LENGTH);
}
