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
  };
