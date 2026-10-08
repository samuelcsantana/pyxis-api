import { wrapText } from './wrap-text';

describe('wrapText', () => {
  it('breaks a paragraph between words so no line passes the width', () => {
    expect(wrapText('one two three four', 9)).toEqual(['one two', 'three', 'four']);
  });

  it('keeps a line that fits the width exactly', () => {
    expect(wrapText('one two', 7)).toEqual(['one two']);
  });

  it('never cuts a word longer than the width', () => {
    expect(wrapText('see https://pyxis.example.com/', 10)).toEqual([
      'see',
      'https://pyxis.example.com/',
    ]);
  });
});
