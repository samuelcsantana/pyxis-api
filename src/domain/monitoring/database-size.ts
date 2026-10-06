export const DATABASE_SIZE_LIMIT_BYTES = 1_000_000_000;
const RATIO_PRECISION = 10_000;

export interface DatabaseSizeProbe {
  currentBytes(): Promise<number>;
}

export interface DatabaseSizeReport {
  readonly bytes: number;
  readonly limitBytes: number;
  readonly ratio: number;
}

export function databaseSizeReport(
  bytes: number,
  limitBytes: number = DATABASE_SIZE_LIMIT_BYTES,
): DatabaseSizeReport {
  return {
    bytes,
    limitBytes,
    ratio: Math.round((bytes / limitBytes) * RATIO_PRECISION) / RATIO_PRECISION,
  };
}
