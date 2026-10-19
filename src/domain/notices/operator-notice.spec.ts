import { InvalidNoticeError, NoticeCampaignExistsError } from '../errors/notice.errors';
import {
  countByLanguage,
  isCampaign,
  MAX_NOTICE_BODY_LENGTH,
  MAX_NOTICE_SUBJECT_LENGTH,
  parseNoticeText,
} from './operator-notice';

describe('parseNoticeText', () => {
  it('takes the first line as the subject and blank-line separated blocks as paragraphs', () => {
    const raw =
      'Our prices change on December 1\r\n\r\nFrom December 1 the monthly plan costs R$ 49.\r\n' +
      'The yearly one stays at R$ 390.\r\n\r\n\r\n  Nothing changes until your next renewal.  \n';

    expect(parseNoticeText(raw, 'en')).toEqual({
      subject: 'Our prices change on December 1',
      paragraphs: [
        'From December 1 the monthly plan costs R$ 49. The yearly one stays at R$ 390.',
        'Nothing changes until your next renewal.',
      ],
    });
  });

  it('refuses a text with no subject or no paragraph, naming the language', () => {
    expect(() => parseNoticeText('   \n\n', 'es')).toThrow(InvalidNoticeError);
    expect(() => parseNoticeText('Only a subject\n\n', 'pt-BR')).toThrow(
      'The pt-BR text of the notice needs a subject line and at least one paragraph.',
    );
  });

  it('refuses a subject or a body longer than an e-mail should carry', () => {
    expect(() =>
      parseNoticeText(`${'s'.repeat(MAX_NOTICE_SUBJECT_LENGTH + 1)}\n\nBody.`, 'en'),
    ).toThrow(/subject over/);
    expect(() =>
      parseNoticeText(`Subject\n\n${'b'.repeat(MAX_NOTICE_BODY_LENGTH + 1)}`, 'en'),
    ).toThrow(/body over/);
  });
});

describe('isCampaign', () => {
  it('accepts lower-case letters, digits and hyphens only', () => {
    expect(isCampaign('prices-2026-12')).toBe(true);
    expect(isCampaign('Prices')).toBe(false);
    expect(isCampaign('-prices')).toBe(false);
    expect(isCampaign('a'.repeat(65))).toBe(false);
  });
});

describe('countByLanguage', () => {
  it('counts the owners of each language, zero included', () => {
    expect(countByLanguage(['pt-BR', 'en', 'pt-BR', 'de', 'nl'])).toEqual({
      en: 1,
      'pt-BR': 2,
      es: 0,
      de: 1,
      fr: 0,
      it: 0,
      nl: 1,
    });
  });
});

describe('notice errors', () => {
  it('carry stable codes and name what went wrong', () => {
    expect(new InvalidNoticeError('en', 'is empty')).toMatchObject({
      code: 'invalid_notice',
      language: 'en',
    });
    expect(new NoticeCampaignExistsError('prices')).toMatchObject({
      code: 'notice_campaign_exists',
      campaign: 'prices',
      message: expect.stringContaining('prices') as string,
    });
  });
});
