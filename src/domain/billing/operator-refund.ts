import type { PaidInvoice } from './billing-gateway';

export const REFUND_MODES = ['full', 'prorata', 'none'] as const;
export type RefundMode = (typeof REFUND_MODES)[number];

const DAY_MS = 24 * 60 * 60 * 1000;

function wholeDays(milliseconds: number): number {
  return Math.floor(milliseconds / DAY_MS);
}

function unusedShare(invoice: PaidInvoice, from: Date): number {
  const periodDays = Math.round(
    (invoice.periodEnd.getTime() - invoice.periodStart.getTime()) / DAY_MS,
  );
  if (periodDays <= 0) {
    return 0;
  }
  const remainingDays = Math.min(
    periodDays,
    Math.max(0, wholeDays(invoice.periodEnd.getTime() - from.getTime())),
  );
  return Math.floor((invoice.amountPaid * remainingDays) / periodDays);
}

export function operatorRefundAmount(mode: RefundMode, invoice: PaidInvoice, from: Date): number {
  switch (mode) {
    case 'none':
      return 0;
    case 'full':
      return invoice.amountPaid;
    case 'prorata':
      return unusedShare(invoice, from);
    default: {
      const unknown: never = mode;
      throw new Error(`Unknown refund mode: ${String(unknown)}`);
    }
  }
}
