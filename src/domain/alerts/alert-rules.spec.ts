import {
  alertDays,
  CONVERSION_DROP_SHARE,
  FAILURE_SPIKE_FACTOR,
  failureRate,
  isConversionDrop,
  isFailureSpike,
  isSilent,
  MIN_COMPARED_CONVERSIONS,
  MIN_FAILED_WRITES,
  MIN_FAILURE_RATE,
  MIN_VISITS_BEFORE_SILENCE,
  mayAlert,
  SILENCE_MS,
} from './alert-rules';

const NOW = new Date('2026-11-05T06:00:00.000Z');
const ACTIVE = { status: 'active', suspendedAt: null, ingestionPausedUntil: null } as const;

describe('the alert thresholds', () => {
  it('are the documented ones, high enough that a small site is not alerted on noise', () => {
    expect({
      SILENCE_MS,
      MIN_VISITS_BEFORE_SILENCE,
      MIN_FAILED_WRITES,
      MIN_FAILURE_RATE,
      FAILURE_SPIKE_FACTOR,
      MIN_COMPARED_CONVERSIONS,
      CONVERSION_DROP_SHARE,
    }).toEqual({
      SILENCE_MS: 86_400_000,
      MIN_VISITS_BEFORE_SILENCE: 20,
      MIN_FAILED_WRITES: 10,
      MIN_FAILURE_RATE: 0.1,
      FAILURE_SPIKE_FACTOR: 2,
      MIN_COMPARED_CONVERSIONS: 10,
      CONVERSION_DROP_SHARE: 0.5,
    });
  });
});

describe('alertDays', () => {
  it('judges the last closed day of the project time zone, with the week before it', () => {
    expect(alertDays('America/Sao_Paulo', NOW)).toEqual({
      day: '2026-11-04',
      comparedDay: '2026-10-28',
      history: { from: '2026-10-29', to: '2026-11-04' },
      usual: { from: '2026-10-28', to: '2026-11-03' },
    });
  });

  it('takes the local calendar, where the day may still be the one before in UTC', () => {
    expect(alertDays('Pacific/Honolulu', NOW).day).toBe('2026-11-03');
    expect(alertDays('Asia/Tokyo', NOW).day).toBe('2026-11-04');
  });
});

describe('mayAlert', () => {
  it.each(['trialing', 'active', 'past_due', 'ending', 'comped', 'free'] as const)(
    'alerts an account in %s, on both plans',
    (status) => {
      expect(mayAlert({ ...ACTIVE, status }, false, NOW)).toBe(true);
    },
  );

  it.each(['incomplete', 'ended'] as const)('never alerts an account in %s', (status) => {
    expect(mayAlert({ ...ACTIVE, status }, false, NOW)).toBe(false);
  });

  it('alerts the operator’s own projects, which have no account', () => {
    expect(mayAlert(null, false, NOW)).toBe(true);
  });

  it('never alerts a suspended account or project, which stopped receiving events on purpose', () => {
    expect(mayAlert({ ...ACTIVE, suspendedAt: NOW }, false, NOW)).toBe(false);
    expect(mayAlert(ACTIVE, true, NOW)).toBe(false);
    expect(mayAlert(null, true, NOW)).toBe(false);
  });

  it('waits for a paused ingestion to end, since its silence is the quota’s', () => {
    const later = new Date(NOW.getTime() + 1);

    expect(mayAlert({ ...ACTIVE, ingestionPausedUntil: later }, false, NOW)).toBe(false);
    expect(mayAlert({ ...ACTIVE, ingestionPausedUntil: NOW }, false, NOW)).toBe(true);
  });
});

describe('isSilent', () => {
  const dayAgo = new Date(NOW.getTime() - SILENCE_MS);

  it('finds a project silent 24 hours after its last event, after enough visits', () => {
    expect(isSilent(dayAgo, MIN_VISITS_BEFORE_SILENCE, NOW)).toBe(true);
  });

  it('waits the whole 24 hours', () => {
    expect(isSilent(new Date(dayAgo.getTime() + 1), MIN_VISITS_BEFORE_SILENCE, NOW)).toBe(false);
  });

  it('leaves alone a site too small for a quiet day to mean anything', () => {
    expect(isSilent(dayAgo, MIN_VISITS_BEFORE_SILENCE - 1, NOW)).toBe(false);
  });

  it('leaves alone a project that never received an event', () => {
    expect(isSilent(null, MIN_VISITS_BEFORE_SILENCE, NOW)).toBe(false);
  });
});

describe('failureRate', () => {
  it('is the failed share of the writes, and 0 without writes', () => {
    expect(failureRate({ failed: 3, total: 12 })).toBe(0.25);
    expect(failureRate({ failed: 0, total: 0 })).toBe(0);
  });
});

describe('isFailureSpike', () => {
  const usual = { failed: 5, total: 100 };

  it('flags a day with enough failures, a high rate, and twice the usual rate', () => {
    expect(isFailureSpike({ failed: 10, total: 100 }, usual)).toBe(true);
    expect(isFailureSpike({ failed: 10, total: 10 }, { failed: 0, total: 0 })).toBe(true);
  });

  it('needs at least ten failures', () => {
    expect(isFailureSpike({ failed: 9, total: 9 }, usual)).toBe(false);
  });

  it('needs at least a tenth of the writes to fail', () => {
    expect(isFailureSpike({ failed: 10, total: 101 }, { failed: 0, total: 100 })).toBe(false);
  });

  it('needs twice the usual rate, so a site that always fails this much is not alerted daily', () => {
    expect(isFailureSpike({ failed: 20, total: 100 }, { failed: 11, total: 100 })).toBe(false);
    expect(isFailureSpike({ failed: 20, total: 100 }, { failed: 10, total: 100 })).toBe(true);
  });
});

describe('isConversionDrop', () => {
  it('flags a day with half the conversions of the same weekday before, or fewer', () => {
    expect(isConversionDrop(5, 10)).toBe(true);
    expect(isConversionDrop(0, 40)).toBe(true);
  });

  it('leaves alone a smaller drop', () => {
    expect(isConversionDrop(6, 10)).toBe(false);
  });

  it('leaves alone a goal too small for a drop to mean anything', () => {
    expect(isConversionDrop(0, MIN_COMPARED_CONVERSIONS - 1)).toBe(false);
  });
});
