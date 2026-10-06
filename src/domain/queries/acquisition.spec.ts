import { CHANNELS } from '../entities/tracked-event.entity';
import { channelsPerDay, noChannelVisits } from './acquisition';

describe('noChannelVisits', () => {
  it('names every channel with zero visits', () => {
    expect(Object.keys(noChannelVisits())).toEqual([...CHANNELS]);
    expect(Object.values(noChannelVisits()).every((visits) => visits === 0)).toBe(true);
  });
});

describe('channelsPerDay', () => {
  it('gives every day of the range every channel, zeros included', () => {
    const days = channelsPerDay(
      ['2026-10-04', '2026-10-05'],
      [
        { date: '2026-10-05', channel: 'paid', visits: 3 },
        { date: '2026-10-05', channel: 'organic', visits: 2 },
      ],
    );

    expect(days[0]).toEqual({ date: '2026-10-04', byChannel: noChannelVisits() });
    expect(days[1]).toEqual({
      date: '2026-10-05',
      byChannel: { ...noChannelVisits(), paid: 3, organic: 2 },
    });
  });
});
