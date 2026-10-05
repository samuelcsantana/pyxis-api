import { SequenceRandomSource } from './sequence-random-source';

describe('SequenceRandomSource', () => {
  it('hands out the sequence in order, wrapping around and continuing across calls', () => {
    const random = new SequenceRandomSource([1, 2, 3]);

    expect(Array.from(random.bytes(4))).toEqual([1, 2, 3, 1]);
    expect(Array.from(random.bytes(3))).toEqual([2, 3, 1]);
  });

  it('refuses an empty sequence', () => {
    expect(() => new SequenceRandomSource([])).toThrow('at least one byte');
  });
});
