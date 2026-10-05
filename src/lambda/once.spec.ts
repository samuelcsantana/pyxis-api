import { once } from './once';

describe('once', () => {
  it('runs the factory a single time and shares its result', async () => {
    const factory = jest.fn(() => Promise.resolve('built'));
    const build = once(factory);

    expect(await Promise.all([build(), build()])).toEqual(['built', 'built']);
    expect(await build()).toBe('built');
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('tries again after a failure instead of remembering it', async () => {
    const factory = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(new Error('parameter store unreachable'))
      .mockResolvedValueOnce('built');
    const build = once(factory);

    await expect(build()).rejects.toThrow('parameter store unreachable');
    expect(await build()).toBe('built');
    expect(factory).toHaveBeenCalledTimes(2);
  });
});
