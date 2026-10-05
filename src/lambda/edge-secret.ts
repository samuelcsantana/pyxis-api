import { timingSafeEqual } from 'node:crypto';

export const EDGE_SECRET_HEADER = 'x-origin-verify';

export function comesFromEdge(
  headers: Readonly<Record<string, string | undefined>> | undefined,
  secret: string | undefined,
): boolean {
  const presented = headers?.[EDGE_SECRET_HEADER];
  if (secret === undefined || secret === '' || presented === undefined) {
    return false;
  }
  const expected = Buffer.from(secret);
  const received = Buffer.from(presented);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
