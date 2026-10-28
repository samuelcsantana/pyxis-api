import { MalformedCsvError, readCsvRecord } from './csv-reader';

describe('readCsvRecord', () => {
  it('reads bare and empty fields', () => {
    expect(readCsvRecord('a,,b\r\n')).toEqual(['a', '', 'b']);
    expect(readCsvRecord('\r\n')).toEqual(['']);
    expect(readCsvRecord('a,\r\n')).toEqual(['a', '']);
  });

  it('reads quoted fields holding quotes, separators and line breaks', () => {
    expect(readCsvRecord('"say ""hi""","a,b","x\r\ny",""\r\n')).toEqual([
      'say "hi"',
      'a,b',
      'x\r\ny',
      '',
    ]);
  });

  it.each([
    ['a record that does not end with CRLF', 'a,b'],
    ['an unquoted field with a quote', 'a"b\r\n'],
    ['an unquoted field with a line break', 'a\nb\r\n'],
    ['a quoted field never closed', '"a""\r\n'],
    ['text after a quoted field', '"a"b,c\r\n'],
  ])('refuses %s', (_, text) => {
    expect(() => readCsvRecord(text)).toThrow(MalformedCsvError);
  });
});
