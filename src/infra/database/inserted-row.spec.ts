import { insertedRow } from './inserted-row';

describe('insertedRow', () => {
  it('returns the row an insert returned', () => {
    expect(insertedRow([{ id: 'a' }])).toEqual({ id: 'a' });
  });

  it('fails loudly when an insert returned nothing', () => {
    expect(() => insertedRow([])).toThrow('returned no row');
  });
});
