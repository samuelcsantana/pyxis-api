import type { EmailLanguage } from '../../domain/auth/email-language';
import {
  SIGN_IN_CODE_EMAIL_MESSAGES,
  type SignInCodeEmailMessages,
} from './sign-in-code-email-messages';

export const SIGN_UP_CODE_EMAIL_MESSAGES: Readonly<Record<EmailLanguage, SignInCodeEmailMessages>> =
  {
    en: {
      ...SIGN_IN_CODE_EMAIL_MESSAGES.en,
      subject: (code) => `${code} is your code to create a Pyxis account`,
      heading: 'Your code to create an account',
      instruction: 'Enter this code on the Pyxis sign-up page to create your account.',
      notRequested:
        'Didn’t ask to create an account? You can ignore this email: nothing is created without this code.',
      reason:
        'You received this email because someone asked to create a Pyxis account with this address.',
    },
    'pt-BR': {
      ...SIGN_IN_CODE_EMAIL_MESSAGES['pt-BR'],
      subject: (code) => `${code} é o seu código para criar a conta no Pyxis`,
      heading: 'Seu código para criar a conta',
      instruction: 'Digite este código na página de cadastro do Pyxis para criar a sua conta.',
      notRequested:
        'Não pediu para criar uma conta? Pode ignorar este e-mail: nada é criado sem este código.',
      reason:
        'Você recebeu este e-mail porque alguém pediu para criar uma conta no Pyxis com este endereço.',
    },
    es: {
      ...SIGN_IN_CODE_EMAIL_MESSAGES.es,
      subject: (code) => `${code} es tu código para crear una cuenta de Pyxis`,
      heading: 'Tu código para crear una cuenta',
      instruction: 'Escribe este código en la página de registro de Pyxis para crear tu cuenta.',
      notRequested:
        '¿No pediste crear una cuenta? Puedes ignorar este correo: no se crea nada sin este código.',
      reason:
        'Recibiste este correo porque alguien pidió crear una cuenta de Pyxis con esta dirección.',
    },
    de: {
      ...SIGN_IN_CODE_EMAIL_MESSAGES.de,
      subject: (code) => `${code} ist dein Code, um ein Pyxis-Konto anzulegen`,
      heading: 'Dein Code zum Anlegen eines Kontos',
      instruction:
        'Gib diesen Code auf der Registrierungsseite von Pyxis ein, um dein Konto anzulegen.',
      notRequested:
        'Du wolltest kein Konto anlegen? Dann kannst du diese E-Mail ignorieren: Ohne diesen ' +
        'Code wird nichts angelegt.',
      reason:
        'Du hast diese E-Mail bekommen, weil jemand mit dieser Adresse ein Pyxis-Konto anlegen ' +
        'wollte.',
    },
    fr: {
      ...SIGN_IN_CODE_EMAIL_MESSAGES.fr,
      subject: (code) => `${code} est votre code pour créer un compte Pyxis`,
      heading: 'Votre code pour créer un compte',
      instruction: 'Saisissez ce code sur la page d’inscription de Pyxis pour créer votre compte.',
      notRequested:
        'Vous n’avez pas demandé à créer un compte ? Vous pouvez ignorer cet e-mail : ' +
        'rien n’est créé sans ce code.',
      reason:
        'Vous recevez cet e-mail parce que quelqu’un a demandé à créer un compte Pyxis avec ' +
        'cette ' +
        'adresse.',
    },
    it: {
      ...SIGN_IN_CODE_EMAIL_MESSAGES.it,
      subject: (code) => `${code} è il tuo codice per creare un account Pyxis`,
      heading: 'Il tuo codice per creare un account',
      instruction:
        'Scrivi questo codice nella pagina di registrazione di Pyxis per creare il tuo account.',
      notRequested:
        'Non hai chiesto di creare un account? Puoi ignorare questa email: senza questo codice ' +
        'non viene creato nulla.',
      reason:
        'Hai ricevuto questa email perché qualcuno ha chiesto di creare un account Pyxis con ' +
        'questo indirizzo.',
    },
    nl: {
      ...SIGN_IN_CODE_EMAIL_MESSAGES.nl,
      subject: (code) => `${code} is je code om een Pyxis-account aan te maken`,
      heading: 'Je code om een account aan te maken',
      instruction: 'Vul deze code in op de registratiepagina van Pyxis om je account aan te maken.',
      notRequested:
        'Niet geprobeerd een account aan te maken? Dan kun je deze e-mail negeren: zonder deze ' +
        'code wordt er niets aangemaakt.',
      reason:
        'Je ontvangt deze e-mail omdat iemand heeft gevraagd om met dit adres een Pyxis-account ' +
        'aan te maken.',
    },
  };
