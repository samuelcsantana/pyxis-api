import { isValidRevenue, REVENUE_CEILING } from './revenue';

describe('isValidRevenue', () => {
  it.each([0, 0.01, 129.9, REVENUE_CEILING - 1])('accepts %p', (value) => {
    expect(isValidRevenue(value)).toBe(true);
  });

  it.each([-0.01, REVENUE_CEILING, Number.NaN, Number.POSITIVE_INFINITY, '129.9', null, true])(
    'refuses %p',
    (value) => {
      expect(isValidRevenue(value)).toBe(false);
    },
  );
});
