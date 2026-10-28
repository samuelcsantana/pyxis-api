import type { EmailLanguage } from '../../domain/auth/email-language';
import { paragraph, type TextBlock, wrapped } from './email-layout';
import { escapeHtml } from './escape-html';

export type SupportWay = 'reply' | 'write';

type SupportSentence = (address: string) => string;

export const SUPPORT_LINES: Readonly<
  Record<EmailLanguage, Readonly<Record<SupportWay, SupportSentence>>>
> = {
  en: {
    reply: (address) => `To ask anything, reply to this e-mail or write to ${address}.`,
    write: (address) => `To ask Pyxis anything, write to ${address}.`,
  },
  'pt-BR': {
    reply: (address) =>
      `Para perguntar qualquer coisa, responda a este e-mail ou escreva para ${address}.`,
    write: (address) => `Para perguntar qualquer coisa ao Pyxis, escreva para ${address}.`,
  },
  es: {
    reply: (address) => `Para preguntar lo que sea, responde a este correo o escribe a ${address}.`,
    write: (address) => `Para preguntarle lo que sea a Pyxis, escribe a ${address}.`,
  },
  de: {
    reply: (address) =>
      `Wenn du Fragen hast, antworte auf diese E-Mail oder schreib an ${address}.`,
    write: (address) => `Wenn du Fragen an Pyxis hast, schreib an ${address}.`,
  },
  fr: {
    reply: (address) => `Pour toute question, répondez à cet e-mail ou écrivez à ${address}.`,
    write: (address) => `Pour toute question sur Pyxis, écrivez à ${address}.`,
  },
  it: {
    reply: (address) => `Per qualsiasi domanda, rispondi a questa email o scrivi a ${address}.`,
    write: (address) => `Per qualsiasi domanda su Pyxis, scrivi a ${address}.`,
  },
  nl: {
    reply: (address) => `Heb je een vraag? Beantwoord deze e-mail of mail naar ${address}.`,
    write: (address) => `Heb je een vraag over Pyxis? Mail naar ${address}.`,
  },
};

export function supportSentence(
  language: EmailLanguage,
  supportEmail: string | null,
  way: SupportWay = 'reply',
): string | null {
  return supportEmail === null ? null : SUPPORT_LINES[language][way](supportEmail);
}

export function supportFootnote(sentence: string | null, block: TextBlock): readonly string[] {
  return sentence === null ? [] : [paragraph(block, escapeHtml(sentence))];
}

export function supportTextLines(sentence: string | null): readonly string[] {
  return sentence === null ? [] : wrapped(sentence);
}
