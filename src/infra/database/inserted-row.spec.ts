import { aggregateRow, insertedRow } from './inserted-row';

describe('insertedRow', () => {
  it('returns the row an insert returned', () => {
    expect(insertedRow([{ id: 'a' }])).toEqual({ id: 'a' });
  });

  it('fails loudly when an insert returned nothing', () => {
    expect(() => insertedRow([])).toThrow('returned no row');
  });
});

describe('aggregateRow', () => {
  it('returns the one row an aggregate returned', () => {
    expect(aggregateRow([{ total: 3 }])).toEqual({ total: 3 });
  });

  it('fails loudly when an aggregate returned nothing', () => {
    expect(() => aggregateRow([])).toThrow('returned no row for an aggregate');
  });
});
