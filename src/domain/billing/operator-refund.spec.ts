import type { PaidInvoice } from './billing-gateway';
import { operatorRefundAmount, REFUND_MODES, type RefundMode } from './operator-refund';

const MONTH: PaidInvoice = {
  invoiceId: 'in_1',
  amountPaid: 3900,
  periodStart: new Date('2026-11-01T00:00:00.000Z'),
  periodEnd: new Date('2026-12-01T00:00:00.000Z'),
};

describe('operatorRefundAmount', () => {
  it('knows three modes', () => {
    expect(REFUND_MODES).toEqual(['full', 'prorata', 'none']);
  });

  it('refunds nothing, or the whole invoice', () => {
    const from = new Date('2026-11-10T12:00:00.000Z');

    expect(operatorRefundAmount('none', MONTH, from)).toBe(0);
    expect(operatorRefundAmount('full', MONTH, from)).toBe(3900);
  });

  it('refunds the whole days left of the period, the current one counting as used, rounding down', () => {
    expect(operatorRefundAmount('prorata', MONTH, new Date('2026-11-10T12:00:00.000Z'))).toBe(
      Math.floor((3900 * 20) / 30),
    );
    expect(operatorRefundAmount('prorata', MONTH, new Date('2026-11-01T00:00:00.000Z'))).toBe(3900);
    expect(operatorRefundAmount('prorata', MONTH, new Date('2026-11-30T23:00:00.000Z'))).toBe(0);
  });

  it('refunds nothing after the period, and never more than the invoice before it', () => {
    expect(operatorRefundAmount('prorata', MONTH, new Date('2026-12-05T00:00:00.000Z'))).toBe(0);
    expect(operatorRefundAmount('prorata', MONTH, new Date('2026-10-20T00:00:00.000Z'))).toBe(3900);
  });

  it('refunds nothing for an invoice without a period', () => {
    const instant = { ...MONTH, periodEnd: MONTH.periodStart };

    expect(operatorRefundAmount('prorata', instant, MONTH.periodStart)).toBe(0);
  });

  it('refuses a mode it does not know', () => {
    expect(() => operatorRefundAmount('half' as RefundMode, MONTH, MONTH.periodStart)).toThrow(
      'Unknown refund mode: half',
    );
  });
});
