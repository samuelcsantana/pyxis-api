import { VISIT_LENGTH_BOUNDS_SECONDS, visitLengthBuckets } from './engagement';

describe('visitLengthBuckets', () => {
  it('names every length bucket by its upper bound, the last one open, zeros included', () => {
    const buckets = visitLengthBuckets([
      { bucket: 0, visits: 4 },
      { bucket: 3, visits: 2 },
      { bucket: 6, visits: 1 },
    ]);

    expect(buckets).toEqual([
      { upToSeconds: 10, visits: 4 },
      { upToSeconds: 30, visits: 0 },
      { upToSeconds: 60, visits: 0 },
      { upToSeconds: 180, visits: 2 },
      { upToSeconds: 600, visits: 0 },
      { upToSeconds: 1800, visits: 0 },
      { upToSeconds: null, visits: 1 },
    ]);
    expect(buckets).toHaveLength(VISIT_LENGTH_BOUNDS_SECONDS.length + 1);
  });
});
