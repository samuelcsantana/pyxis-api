export type SignInCodeEmailLanguage = 'en';

export interface SignInCodeEmailMessages {
  readonly language: SignInCodeEmailLanguage;
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

export const SIGN_IN_CODE_EMAIL_MESSAGES: Readonly<
  Record<SignInCodeEmailLanguage, SignInCodeEmailMessages>
> = {
  en: {
    language: 'en',
    subject: (code) => `${code} is your Pyxis sign-in code`,
    preheader: (code, minutes) =>
      `Your code is ${code}. It expires in ${String(minutes)} minutes and works once.`,
    heading: 'Your sign-in code',
    instruction: 'Enter this code on the Pyxis sign-in page to open your dashboard.',
    expiry: (minutes) => `It expires in ${String(minutes)} minutes and works once.`,
    neverShare: 'Never share this code. Pyxis will never ask you for it.',
    notRequested: 'Did not ask to sign in? Ignore this email: nobody can sign in without the code.',
    about: 'Pyxis is privacy-first product analytics: no cookies, no personal data in events.',
    reason:
      'You received this email because a sign-in to the Pyxis dashboard was requested for this address.',
    dashboard: 'Dashboard',
    logoAlt: 'Pyxis',
  },
};
