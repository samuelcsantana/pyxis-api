import { SystemClock } from './system-clock';

describe('SystemClock', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-10-06T14:00:00.000Z') });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reads the current time', () => {
    expect(new SystemClock().now()).toEqual(new Date('2026-10-06T14:00:00.000Z'));
  });
});
