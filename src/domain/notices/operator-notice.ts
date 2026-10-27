import type { EmailLanguage } from '../auth/email-language';
import type { AccountStatus } from '../accounts/account-status';
import { InvalidNoticeError } from '../errors/notice.errors';

export const CAMPAIGN_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const MAX_CAMPAIGN_LENGTH = 64;
export const MAX_NOTICE_SUBJECT_LENGTH = 200;
export const MAX_NOTICE_BODY_LENGTH = 10_000;
export const NOTICE_BATCH_SIZE = 500;
export const NOTICE_AUDIENCE: readonly AccountStatus[] = [
  'trialing',
  'active',
  'past_due',
  'ending',
  'comped',
  'free',
];
export const ENDED_AUDIENCE: readonly AccountStatus[] = [...NOTICE_AUDIENCE, 'ended'];

const WINDOWS_LINE_BREAK = /\r\n/g;
const PARAGRAPH_BREAK = /\n\s*\n/;
const LINE_BREAK = '\n';

export interface NoticeText {
  readonly subject: string;
  readonly paragraphs: readonly string[];
}

export type NoticeContent = Readonly<Record<EmailLanguage, NoticeText>>;

export type NoticeAudienceCount = Readonly<Record<EmailLanguage, number>>;

export function isCampaign(value: string): boolean {
  return CAMPAIGN_PATTERN.test(value);
}

function joinedLines(block: string): string {
  return block
    .split(LINE_BREAK)
    .map((line) => line.trim())
    .join(' ')
    .trim();
}

export function parseNoticeText(raw: string, language: EmailLanguage): NoticeText {
  const lines = raw.replace(WINDOWS_LINE_BREAK, LINE_BREAK).trim().split(LINE_BREAK);
  const subject = lines.slice(0, 1).join('').trim();
  const paragraphs = lines
    .slice(1)
    .join(LINE_BREAK)
    .split(PARAGRAPH_BREAK)
    .map(joinedLines)
    .filter((block) => block.length > 0);
  if (subject.length === 0 || paragraphs.length === 0) {
    throw new InvalidNoticeError(language, 'needs a subject line and at least one paragraph');
  }
  if (subject.length > MAX_NOTICE_SUBJECT_LENGTH) {
    throw new InvalidNoticeError(
      language,
      `has a subject over ${String(MAX_NOTICE_SUBJECT_LENGTH)} characters`,
    );
  }
  if (paragraphs.join('').length > MAX_NOTICE_BODY_LENGTH) {
    throw new InvalidNoticeError(
      language,
      `has a body over ${String(MAX_NOTICE_BODY_LENGTH)} characters`,
    );
  }
  return { subject, paragraphs };
}

export function countByLanguage(languages: readonly EmailLanguage[]): NoticeAudienceCount {
  return {
    en: languages.filter((language) => language === 'en').length,
    'pt-BR': languages.filter((language) => language === 'pt-BR').length,
    es: languages.filter((language) => language === 'es').length,
    de: languages.filter((language) => language === 'de').length,
    fr: languages.filter((language) => language === 'fr').length,
    it: languages.filter((language) => language === 'it').length,
    nl: languages.filter((language) => language === 'nl').length,
  };
}
