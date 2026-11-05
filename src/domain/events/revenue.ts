import { SMALLEST_PERSONAL_INTEGER } from './pii-barrier';

export const REVENUE_PROPERTY = 'revenue';
export const REVENUE_CEILING = SMALLEST_PERSONAL_INTEGER;

export function isValidRevenue(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < REVENUE_CEILING
  );
}
