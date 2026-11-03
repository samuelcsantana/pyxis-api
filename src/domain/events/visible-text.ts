const HIDDEN_CHARACTER = /(?![\t\n\r‌‍])[\p{Cc}\p{Cf}\p{Cs}]/gu;

export function visibleText(text: string): string {
  return text.replace(HIDDEN_CHARACTER, '');
}
