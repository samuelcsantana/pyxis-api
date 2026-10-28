import { propertySummaryOf } from './property-summary';

const REQUEST = { name: 'article_read_100', key: 'seconds', by: 'post' };
const OVERALL = { events: 9, median: 33, p25: 15, p75: 39 };

describe('propertySummaryOf', () => {
  it('orders the groups by events then value and counts the events of the rest', () => {
    const report = propertySummaryOf(REQUEST, {
      overall: OVERALL,
      groups: [
        { value: 'b-post', events: 2, median: 20, p25: 10, p75: 30 },
        { value: 'c-post', events: 4, median: 40, p25: 35, p75: 45 },
        { value: 'a-post', events: 2, median: 12, p25: 12, p75: 12 },
      ],
      groupedEvents: 9,
    });

    expect(report).toEqual({
      ...REQUEST,
      overall: OVERALL,
      groups: [
        { value: 'c-post', events: 4, median: 40, p25: 35, p75: 45 },
        { value: 'a-post', events: 2, median: 12, p25: 12, p75: 12 },
        { value: 'b-post', events: 2, median: 20, p25: 10, p75: 30 },
      ],
      otherCount: 1,
    });
  });

  it('answers no groups and no rest without a split', () => {
    expect(
      propertySummaryOf(
        { ...REQUEST, by: null },
        { overall: OVERALL, groups: [], groupedEvents: 0 },
      ),
    ).toEqual({ ...REQUEST, by: null, overall: OVERALL, groups: [], otherCount: 0 });
  });
});
