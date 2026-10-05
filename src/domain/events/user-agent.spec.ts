import { classifyUserAgent, isBotUserAgent } from './user-agent';

const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';
const CHROME_ANDROID =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
const SAMSUNG_INTERNET =
  'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36';
const EDGE_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0';

describe('classifyUserAgent', () => {
  it.each([
    ['Safari on iOS', SAFARI_IPHONE, 'safari', 'ios', 'mobile'],
    ['Chrome on Android', CHROME_ANDROID, 'chrome', 'android', 'mobile'],
    ['Samsung Internet', SAMSUNG_INTERNET, 'samsung', 'android', 'mobile'],
    ['Edge on Windows', EDGE_WINDOWS, 'edge', 'windows', 'desktop'],
    [
      'Edge on Android',
      'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36 EdgA/141.0.0.0',
      'edge',
      'android',
      'mobile',
    ],
    [
      'Edge on iOS',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 EdgiOS/141.0.0.0 Mobile/15E148 Safari/605.1.15',
      'edge',
      'ios',
      'mobile',
    ],
    [
      'Chrome on iOS',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.0.0 Mobile/15E148 Safari/604.1',
      'chrome',
      'ios',
      'mobile',
    ],
    [
      'Firefox on iOS',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/143.0 Mobile/15E148 Safari/605.1.15',
      'firefox',
      'ios',
      'mobile',
    ],
    [
      'Firefox on Linux',
      'Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0',
      'firefox',
      'linux',
      'desktop',
    ],
    [
      'Firefox on an Android tablet',
      'Mozilla/5.0 (Android 14; Tablet; rv:143.0) Gecko/143.0 Firefox/143.0',
      'firefox',
      'android',
      'tablet',
    ],
    [
      'Opera on macOS',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 OPR/124.0.0.0',
      'opera',
      'macos',
      'desktop',
    ],
    [
      'Safari on macOS',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
      'safari',
      'macos',
      'desktop',
    ],
    [
      'Safari on iPad',
      'Mozilla/5.0 (iPad; CPU OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
      'safari',
      'ios',
      'tablet',
    ],
    [
      'Chrome on an Android tablet',
      'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
      'chrome',
      'android',
      'tablet',
    ],
    [
      'Chrome on a Chromebook',
      'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
      'chrome',
      'chromeos',
      'desktop',
    ],
    [
      'an in-app browser on iOS',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0',
      'other',
      'ios',
      'mobile',
    ],
    ['a command-line client', 'curl/8.9.1', 'other', 'other', 'other'],
  ])('classifies %s', (_, userAgent, browser, os, deviceType) => {
    expect(classifyUserAgent(userAgent, {})).toEqual({ browser, os, deviceType });
  });

  it.each([SAMSUNG_INTERNET, EDGE_WINDOWS])('never mistakes %s for Chrome', (userAgent) => {
    expect(classifyUserAgent(userAgent, {}).browser).not.toBe('chrome');
  });

  it('classifies a missing user agent as other', () => {
    expect(classifyUserAgent(undefined, {})).toEqual({
      browser: 'other',
      os: 'other',
      deviceType: 'other',
    });
  });

  it.each([
    ['"Android"', 'android'],
    ['"iOS"', 'ios'],
    ['"Windows"', 'windows'],
    ['"macOS"', 'macos'],
    ['"Linux"', 'linux'],
    ['"Chrome OS"', 'chromeos'],
    ['"ChromeOS"', 'chromeos'],
  ])('prefers the platform hint %s over the user agent', (platform, os) => {
    expect(classifyUserAgent('Mozilla/5.0 (Unknown)', { platform }).os).toBe(os);
  });

  it('falls back to the user agent when the platform hint is unknown', () => {
    expect(classifyUserAgent(EDGE_WINDOWS, { platform: '"Unknown"' }).os).toBe('windows');
  });

  it('reads a phone from the mobile hint even when the user agent asks for the desktop site', () => {
    const desktopSite =
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

    expect(classifyUserAgent(desktopSite, { mobile: '?1', platform: '"Android"' })).toEqual({
      browser: 'chrome',
      os: 'android',
      deviceType: 'mobile',
    });
  });

  it('keeps the user agent reading when the mobile hint says not mobile', () => {
    expect(classifyUserAgent(EDGE_WINDOWS, { mobile: '?0', platform: '"Windows"' })).toEqual({
      browser: 'edge',
      os: 'windows',
      deviceType: 'desktop',
    });
  });
});

describe('isBotUserAgent', () => {
  it.each([
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (compatible; bingbot/2.0)',
    'Mozilla/5.0 (compatible; AhrefsCrawler/1.0)',
    'Baiduspider+(+http://www.baidu.com/search/spider.htm)',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse',
  ])('flags %s', (userAgent) => {
    expect(isBotUserAgent(userAgent)).toBe(true);
  });

  it.each([SAFARI_IPHONE, CHROME_ANDROID, SAMSUNG_INTERNET, EDGE_WINDOWS, undefined])(
    'lets %s through',
    (userAgent) => {
      expect(isBotUserAgent(userAgent)).toBe(false);
    },
  );
});
