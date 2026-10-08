import { escapeHtml } from './escape-html';

describe('escapeHtml', () => {
  it('turns the five characters HTML gives a meaning into entities', () => {
    expect(escapeHtml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;',
    );
  });

  it('escapes the ampersand once, never an entity it has just written', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('leaves plain text as it is', () => {
    expect(escapeHtml('123456 is your code')).toBe('123456 is your code');
  });
});
