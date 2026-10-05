import { writeNoticeToStderr } from './cli-context';

describe('writeNoticeToStderr', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps Postgres notices off stdout, where a secret key may be piped', () => {
    const stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

    writeNoticeToStderr({ message: 'relation already exists' });
    writeNoticeToStderr({});

    expect(stderr.mock.calls).toEqual([
      ['postgres notice: relation already exists\n'],
      ['postgres notice: \n'],
    ]);
  });
});
