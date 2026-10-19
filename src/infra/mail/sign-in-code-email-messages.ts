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
    es: {
      language: 'es',
      subject: (code) => `${code} es tu código para iniciar sesión en Pyxis`,
      preheader: (code, minutes) =>
        `Tu código es ${code}. Expira en ${String(minutes)} minutos y solo sirve una vez.`,
      heading: 'Tu código para iniciar sesión',
      instruction:
        'Escribe este código en la página “Iniciar sesión en Pyxis” para abrir tu panel.',
      expiry: (minutes) => `Expira en ${String(minutes)} minutos y solo sirve una vez.`,
      neverShare: 'Nunca compartas este código. Nadie de Pyxis te lo va a pedir.',
      notRequested:
        '¿No pediste iniciar sesión? Puedes ignorar este correo: nadie puede entrar sin este código.',
      about:
        'Pyxis es analítica de producto que prioriza la privacidad: ' +
        'sin cookies y sin datos personales en los eventos.',
      reason:
        'Recibiste este correo porque alguien pidió iniciar sesión en el panel de Pyxis ' +
        'con esta dirección.',
      dashboard: 'Panel',
      logoAlt: 'Pyxis',
    },
    de: {
      language: 'de',
      subject: (code) => `${code} ist dein Code für die Anmeldung bei Pyxis`,
      preheader: (code, minutes) =>
        `Dein Code ist ${code}. Er läuft in ${String(minutes)} Minuten ab und gilt nur einmal.`,
      heading: 'Dein Code für die Anmeldung',
      instruction:
        'Gib diesen Code auf der Seite „Bei Pyxis anmelden“ ein, um dein Dashboard zu öffnen.',
      expiry: (minutes) => `Er läuft in ${String(minutes)} Minuten ab und gilt nur einmal.`,
      neverShare:
        'Gib diesen Code niemals weiter. Niemand von Pyxis wird dich jemals danach fragen.',
      notRequested:
        'Du wolltest dich nicht anmelden? Dann kannst du diese E-Mail ignorieren: Ohne diesen ' +
        'Code kann sich niemand anmelden.',
      about:
        'Pyxis ist datenschutzfreundliche Produktanalyse: ' +
        'keine Cookies, keine personenbezogenen Daten in den Ereignissen.',
      reason:
        'Du hast diese E-Mail bekommen, weil für diese Adresse eine Anmeldung im Pyxis-Dashboard ' +
        'angefordert wurde.',
      dashboard: 'Dashboard',
      logoAlt: 'Pyxis',
    },
    fr: {
      language: 'fr',
      subject: (code) => `${code} est votre code de connexion à Pyxis`,
      preheader: (code, minutes) =>
        `Votre code est ${code}. Il expire dans ${String(minutes)} minutes et ne sert qu’une fois.`,
      heading: 'Votre code de connexion',
      instruction:
        'Saisissez ce code sur la page de connexion de Pyxis pour ouvrir votre tableau de bord.',
      expiry: (minutes) => `Il expire dans ${String(minutes)} minutes et ne sert qu’une fois.`,
      neverShare: 'Ne communiquez jamais ce code. Personne chez Pyxis ne vous le demandera.',
      notRequested:
        'Vous n’avez pas demandé à vous connecter ? Vous pouvez ignorer cet e-mail : ' +
        'personne ne peut se connecter sans ce code.',
      about:
        'Pyxis est un outil d’analytique produit respectueux de la vie privée : ' +
        'aucun cookie, aucune donnée personnelle dans les événements.',
      reason:
        'Vous recevez cet e-mail parce qu’une connexion au tableau de bord Pyxis a été demandée ' +
        'pour cette adresse.',
      dashboard: 'Tableau de bord',
      logoAlt: 'Pyxis',
    },
    it: {
      language: 'it',
      subject: (code) => `${code} è il tuo codice di accesso a Pyxis`,
      preheader: (code, minutes) =>
        `Il tuo codice è ${code}. Scade tra ${String(minutes)} minuti e vale una sola volta.`,
      heading: 'Il tuo codice di accesso',
      instruction:
        'Scrivi questo codice nella pagina “Accedi a Pyxis” per aprire la tua dashboard.',
      expiry: (minutes) => `Scade tra ${String(minutes)} minuti e vale una sola volta.`,
      neverShare: 'Non condividere mai questo codice. Nessuno di Pyxis te lo chiederà mai.',
      notRequested:
        'Non hai chiesto di accedere? Puoi ignorare questa email: nessuno può accedere senza ' +
        'questo codice.',
      about:
        'Pyxis è uno strumento di analisi di prodotto attento alla privacy: ' +
        'nessun cookie e nessun dato personale negli eventi.',
      reason:
        'Hai ricevuto questa email perché è stato richiesto un accesso alla dashboard di Pyxis ' +
        'con questo indirizzo.',
      dashboard: 'Dashboard',
      logoAlt: 'Pyxis',
    },
    nl: {
      language: 'nl',
      subject: (code) => `${code} is je inlogcode voor Pyxis`,
      preheader: (code, minutes) =>
        `Je code is ${code}. Hij verloopt over ${String(minutes)} minuten en werkt één keer.`,
      heading: 'Je inlogcode',
      instruction: 'Vul deze code in op de inlogpagina van Pyxis om je dashboard te openen.',
      expiry: (minutes) => `Hij verloopt over ${String(minutes)} minuten en werkt één keer.`,
      neverShare: 'Deel deze code nooit. Niemand van Pyxis zal je er ooit om vragen.',
      notRequested:
        'Niet geprobeerd in te loggen? Dan kun je deze e-mail negeren: niemand kan inloggen ' +
        'zonder deze code.',
      about:
        'Pyxis is productanalyse die privacy vooropstelt: ' +
        'geen cookies en geen persoonsgegevens in events.',
      reason:
        'Je ontvangt deze e-mail omdat er voor dit adres is gevraagd om in te loggen op het ' +
        'Pyxis-dashboard.',
      dashboard: 'Dashboard',
      logoAlt: 'Pyxis',
    },
  };
