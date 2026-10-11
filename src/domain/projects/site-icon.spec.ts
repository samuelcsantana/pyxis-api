import { iconCandidates, iconVersion, MAX_ICON_CANDIDATES, sniffIconType } from './site-icon';

const PAGE = 'https://shop.example.com/';

function head(...links: string[]): string {
  return `<!doctype html><html><head><title>Shop</title>${links.join('')}</head><body></body></html>`;
}

describe('iconCandidates', () => {
  it('prefers the touch icon, then the largest declared icon, then /favicon.ico', () => {
    const html = head(
      '<link rel="icon" href="/favicon.ico?v=1" sizes="48x48" type="image/x-icon"/>',
      '<link rel="icon" href="/icon.png?v=2" sizes="512x512" type="image/png"/>',
      '<link rel="apple-touch-icon" href="/apple-icon.png" sizes="180x180"/>',
    );

    expect(iconCandidates(html, PAGE)).toEqual([
      'https://shop.example.com/apple-icon.png',
      'https://shop.example.com/icon.png?v=2',
      'https://shop.example.com/favicon.ico?v=1',
      'https://shop.example.com/favicon.ico',
    ]);
  });

  it('reads attributes in any order and quoting, and rel lists like "shortcut icon"', () => {
    const html = head(
      "<LINK HREF='/a.png' REL='shortcut icon'>",
      '<link sizes=64x64 href=/b.png rel=icon>',
    );

    expect(iconCandidates(html, PAGE)).toEqual([
      'https://shop.example.com/b.png',
      'https://shop.example.com/a.png',
      'https://shop.example.com/favicon.ico',
    ]);
  });

  it('puts the touch icon first wherever it is declared, and skips a link without rel', () => {
    const html = head(
      '<link rel="apple-touch-icon" href="/apple.png">',
      '<link href="/no-rel.png">',
      '<link rel="icon" href="/icon.png" sizes="32x32">',
    );

    expect(iconCandidates(html, PAGE)).toEqual([
      'https://shop.example.com/apple.png',
      'https://shop.example.com/icon.png',
      'https://shop.example.com/favicon.ico',
    ]);
  });

  it('keeps the precomposed touch icon and decodes &amp; in the address', () => {
    const html = head('<link rel="apple-touch-icon-precomposed" href="/touch.png?a=1&amp;b=2">');

    expect(iconCandidates(html, PAGE)[0]).toBe('https://shop.example.com/touch.png?a=1&b=2');
  });

  it('never offers an SVG, by type or by extension', () => {
    const html = head(
      '<link rel="icon" href="/icon.svg" type="image/svg+xml">',
      '<link rel="icon" href="/mark.SVG?v=3">',
      '<link rel="icon" href="/mark" type="image/svg+xml">',
    );

    expect(iconCandidates(html, PAGE)).toEqual(['https://shop.example.com/favicon.ico']);
  });

  it('ignores links that are not icons, without an address, or not secure', () => {
    const html = head(
      '<link rel="stylesheet" href="/site.css">',
      '<link rel="icon">',
      '<link rel="icon" href="   ">',
      '<link rel="icon" href="http://cdn.example.com/icon.png">',
      '<link rel="icon" href="data:image/png;base64,AAAA">',
      '<link rel="icon" href="https://[::1">',
    );

    expect(iconCandidates(html, PAGE)).toEqual(['https://shop.example.com/favicon.ico']);
  });

  it('resolves icons served from another secure host', () => {
    const html = head(
      '<link rel="icon" href="https://cdn.example.net/shop/icon.png" sizes="32x32">',
    );

    expect(iconCandidates(html, PAGE)[0]).toBe('https://cdn.example.net/shop/icon.png');
  });

  it('reads a page with no head as just /favicon.ico', () => {
    expect(iconCandidates('', PAGE)).toEqual(['https://shop.example.com/favicon.ico']);
  });

  it('offers nothing when the page itself is not secure', () => {
    expect(
      iconCandidates(head('<link rel="icon" href="/icon.png">'), 'http://shop.example.com/'),
    ).toEqual([]);
  });

  it(`offers at most ${String(MAX_ICON_CANDIDATES)} addresses, once each`, () => {
    const html = head(
      '<link rel="icon" href="/1.png" sizes="16x16">',
      '<link rel="icon" href="/2.png" sizes="32x32">',
      '<link rel="icon" href="/2.png" sizes="32x32">',
      '<link rel="icon" href="/3.png" sizes="64x64">',
      '<link rel="icon" href="/4.png" sizes="128x128">',
      '<link rel="icon" href="/5.png" sizes="any">',
    );

    expect(iconCandidates(html, PAGE)).toEqual([
      'https://shop.example.com/4.png',
      'https://shop.example.com/3.png',
      'https://shop.example.com/2.png',
      'https://shop.example.com/1.png',
    ]);
  });
});

describe('sniffIconType', () => {
  it.each([
    ['image/png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]],
    ['image/x-icon', [0x00, 0x00, 0x01, 0x00, 0x01]],
    ['image/jpeg', [0xff, 0xd8, 0xff, 0xe0]],
    ['image/gif', [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
    ['image/webp', [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]],
  ])('recognises %s by its first bytes', (type, bytes) => {
    expect(sniffIconType(Uint8Array.from(bytes))).toBe(type);
  });

  it.each([
    ['an HTML page', new TextEncoder().encode('<!doctype html><title>Not found</title>')],
    ['an SVG', new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>')],
    [
      'a RIFF that is not WEBP',
      Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45]),
    ],
    ['nothing', new Uint8Array()],
  ])('refuses %s', (_, bytes) => {
    expect(sniffIconType(bytes)).toBeNull();
  });
});

describe('iconVersion', () => {
  it('is a short hash of the bytes, the same for the same bytes', () => {
    const bytes = Uint8Array.from([1, 2, 3]);

    expect(iconVersion(bytes)).toMatch(/^[0-9a-f]{16}$/);
    expect(iconVersion(Uint8Array.from([1, 2, 3]))).toBe(iconVersion(bytes));
    expect(iconVersion(Uint8Array.from([1, 2, 4]))).not.toBe(iconVersion(bytes));
  });
});
