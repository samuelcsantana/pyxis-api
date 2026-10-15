import {
  exportAvailableUntil,
  exportDayStart,
  exportObjectKey,
  stalledExportCutoff,
} from './project-export';

const NOW = new Date('2026-11-02T13:00:00.000Z');

describe('a project export', () => {
  it('stays downloadable for seven days after it is ready', () => {
    expect(exportAvailableUntil(NOW)).toEqual(new Date('2026-11-09T13:00:00.000Z'));
  });

  it('counts the exports of the last day against the daily limit', () => {
    expect(exportDayStart(NOW)).toEqual(new Date('2026-11-01T13:00:00.000Z'));
  });

  it('is tried again by the daily job when it waited more than fifteen minutes', () => {
    expect(stalledExportCutoff(NOW)).toEqual(new Date('2026-11-02T12:45:00.000Z'));
  });

  it('is stored under its project, compressed', () => {
    expect(exportObjectKey('p-1', 'e-1')).toBe('exports/p-1/e-1.csv.gz');
  });
});
