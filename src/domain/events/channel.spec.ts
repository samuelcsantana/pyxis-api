import type { Attribution } from '../entities/tracked-event.entity';
import { classifyChannel } from './channel';

const NOTHING: Attribution = {
  referrerHost: null,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  fromAdClick: false,
};

function attribution(overrides: Partial<Attribution>): Attribution {
  return { ...NOTHING, ...overrides };
}

describe('classifyChannel', () => {
  it('is paid when the URL carried an ad click id', () => {
    expect(classifyChannel(attribution({ fromAdClick: true }))).toBe('paid');
  });

  it('is paid even when the visit came from a social network', () => {
    expect(classifyChannel(attribution({ fromAdClick: true, referrerHost: 'instagram.com' }))).toBe(
      'paid',
    );
  });

  it.each(['cpc', 'PPC', 'paid', 'paidsearch', 'paid_social', 'display'])(
    'is paid for the medium %s',
    (utmMedium) => {
      expect(classifyChannel(attribution({ utmSource: 'google', utmMedium }))).toBe('paid');
    },
  );

  it.each(['email', 'E-mail', 'newsletter'])('is email for the medium %s', (utmMedium) => {
    expect(classifyChannel(attribution({ utmMedium }))).toBe('email');
  });

  it.each(['social', 'social-network', 'social-media', 'social_media', 'sm'])(
    'is social for the medium %s',
    (utmMedium) => {
      expect(classifyChannel(attribution({ utmMedium }))).toBe('social');
    },
  );

  it.each([
    ['an unknown medium', { utmSource: 'partner', utmMedium: 'affiliate' }],
    ['only a source', { utmSource: 'partner' }],
    ['only a campaign', { utmCampaign: 'black-friday' }],
    ['utm tags on a visit from a search engine', { utmSource: 'blog', referrerHost: 'google.com' }],
  ])('is campaign for %s', (_, overrides) => {
    expect(classifyChannel(attribution(overrides))).toBe('campaign');
  });

  it.each([
    'facebook.com',
    'm.facebook.com',
    'l.instagram.com',
    't.co',
    'www.linkedin.com',
    'wa.me',
  ])('is social for a visit from %s', (referrerHost) => {
    expect(classifyChannel(attribution({ referrerHost }))).toBe('social');
  });

  it.each([
    'www.google.com.br',
    'google.com',
    'google.co.uk',
    'google.de',
    'bing.com',
    'duckduckgo.com',
    'br.search.yahoo.com',
    'search.yahoo.com',
    'yandex.ru',
    'baidu.com',
    'ecosia.org',
    'search.brave.com',
    'startpage.com',
    'qwant.com',
  ])('is organic for a visit from %s', (referrerHost) => {
    expect(classifyChannel(attribution({ referrerHost }))).toBe('organic');
  });

  it.each(['blog.example.com', 'mail.google.com', 'notfacebook.com', 'googleblog.com'])(
    'is referral for a visit from %s',
    (referrerHost) => {
      expect(classifyChannel(attribution({ referrerHost }))).toBe('referral');
    },
  );

  it('is direct when nothing is known', () => {
    expect(classifyChannel(NOTHING)).toBe('direct');
  });
});
