import { breakdownByKey, type PropertyValueCount } from './property-breakdown';

function count(
  key: string,
  value: string,
  counted: number,
  keyEvents: number,
  visits = counted,
): PropertyValueCount {
  return { key, value, count: counted, visits, keyEvents };
}

describe('breakdownByKey', () => {
  it('groups the values under their key, the most counted first', () => {
    const keys = breakdownByKey([
      count('calculator', '99food', 4, 10, 3),
      count('calculator', 'ifood', 6, 10, 5),
    ]);

    expect(keys).toEqual([
      {
        key: 'calculator',
        events: 10,
        values: [
          { value: 'ifood', count: 6, visits: 5 },
          { value: '99food', count: 4, visits: 3 },
        ],
        otherCount: 0,
      },
    ]);
  });

  it('counts what the top values leave out as other', () => {
    const [key] = breakdownByKey([count('plan', 'mei', 5, 12), count('plan', 'simples', 3, 12)]);

    expect(key?.otherCount).toBe(4);
  });

  it('orders keys by the events that carry them, then by name, and ties of values by name', () => {
    const keys = breakdownByKey([
      count('source', 'manual', 2, 4),
      count('source', 'import', 2, 4),
      count('kind', 'ifood', 9, 9),
      count('channel', 'store', 4, 4),
    ]);

    expect(keys.map((key) => key.key)).toEqual(['kind', 'channel', 'source']);
    expect(keys[2]?.values.map((value) => value.value)).toEqual(['import', 'manual']);
  });

  it('has no keys when the event carries no property', () => {
    expect(breakdownByKey([])).toEqual([]);
  });
});
