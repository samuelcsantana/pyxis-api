export const EMAIL_LANGUAGES = ['en', 'pt-BR'] as const;

export type EmailLanguage = (typeof EMAIL_LANGUAGES)[number];

export const DEFAULT_EMAIL_LANGUAGE: EmailLanguage = 'en';

const SUBTAG_SEPARATOR = '-';

function primarySubtag(tag: string): string {
  const separator = tag.indexOf(SUBTAG_SEPARATOR);
  return (separator === -1 ? tag : tag.slice(0, separator)).toLowerCase();
}

export function resolveEmailLanguage(requested: string | undefined): EmailLanguage {
  if (requested === undefined) {
    return DEFAULT_EMAIL_LANGUAGE;
  }
  const wanted = primarySubtag(requested);
  return (
    EMAIL_LANGUAGES.find((language) => primarySubtag(language) === wanted) ?? DEFAULT_EMAIL_LANGUAGE
  );
}
