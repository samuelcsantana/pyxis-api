export const ADDRESS_SEPARATOR = '@';
export const TAG_SEPARATOR = '+';
export const GMAIL_DOMAIN = 'gmail.com';
export const GMAIL_DOMAINS: readonly string[] = [GMAIL_DOMAIN, 'googlemail.com'];
export const GMAIL_IGNORED_CHARACTER = '.';

function splitPart(text: string, separator: string, index: number): string {
  return text.split(separator)[index] ?? '';
}

export function mailboxOf(email: string): string {
  const address = email.toLowerCase();
  const localPart = splitPart(address, ADDRESS_SEPARATOR, 0);
  const domain = splitPart(address, ADDRESS_SEPARATOR, 1);
  const beforeTag = splitPart(localPart, TAG_SEPARATOR, 0);
  const untagged = beforeTag === '' ? localPart : beforeTag;
  return GMAIL_DOMAINS.includes(domain)
    ? `${untagged.replaceAll(GMAIL_IGNORED_CHARACTER, '')}${ADDRESS_SEPARATOR}${GMAIL_DOMAIN}`
    : `${untagged}${ADDRESS_SEPARATOR}${domain}`;
}
