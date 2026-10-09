import type { EmailLanguage } from '../../domain/auth/email-language';

export interface SignInCodeEmailMessages {
  readonly language: EmailLanguage;
  readonly subject: (code: string) => string;
  readonly preheader: (code: string, minutes: number) => string;
  readonly heading: string;
  readonly instruction: string;
  readonly expiry: (minutes: number) => string;
  readonly neverShare: string;
  readonly notRequested: string;
  readonly about: string;
  readonly reason: string;
  readonly dashboard: string;
  readonly logoAlt: string;
}

export const SIGN_IN_CODE_EMAIL_MESSAGES: Readonly<Record<EmailLanguage, SignInCodeEmailMessages>> =
  {
    en: {
      language: 'en',
      subject: (code) => `${code} is your Pyxis sign-in code`,
      preheader: (code, minutes) =>
        `Your code is ${code}. It expires in ${String(minutes)} minutes and works once.`,
      heading: 'Your sign-in code',
      instruction: 'Enter this code on the Pyxis sign-in page to open your dashboard.',
      expiry: (minutes) => `It expires in ${String(minutes)} minutes and works once.`,
      neverShare: 'Never share this code. No one from Pyxis will ever ask you for it.',
      notRequested:
        'Didn’t ask to sign in? You can ignore this email: no one can sign in without this code.',
      about: 'Pyxis is privacy-first product analytics: no cookies, no personal data in events.',
      reason:
        'You received this email because a sign-in to the Pyxis dashboard was requested for this address.',
      dashboard: 'Dashboard',
      logoAlt: 'Pyxis',
    },
    'pt-BR': {
      language: 'pt-BR',
      subject: (code) => `${code} é o seu código para entrar no Pyxis`,
      preheader: (code, minutes) =>
        `Seu código é ${code}. Ele expira em ${String(minutes)} minutos e só vale uma vez.`,
      heading: 'Seu código para entrar',
      instruction: 'Digite este código na página “Entrar no Pyxis” para abrir o seu painel.',
      expiry: (minutes) => `Ele expira em ${String(minutes)} minutos e só vale uma vez.`,
      neverShare: 'Nunca compartilhe este código. Ninguém do Pyxis vai pedir esse código a você.',
      notRequested:
        'Não pediu para entrar? Pode ignorar este e-mail: ninguém entra sem este código.',
      about:
        'O Pyxis é uma ferramenta de análise de produto que respeita a privacidade: ' +
        'sem cookies e sem dados pessoais nos eventos.',
      reason:
        'Você recebeu este e-mail porque alguém pediu para entrar no painel do Pyxis ' +
        'com este endereço.',
      dashboard: 'Painel',
      logoAlt: 'Pyxis',
    },
  };
