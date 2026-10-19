import type { EmailLanguage } from '../../domain/auth/email-language';
import { SIGN_IN_CODE_EMAIL_MESSAGES } from './sign-in-code-email-messages';

export interface InvitationWords {
  readonly project: string;
  readonly inviter: string;
}

export interface InvitationEmailMessages {
  readonly language: EmailLanguage;
  readonly subject: (words: InvitationWords) => string;
  readonly preheader: (words: InvitationWords) => string;
  readonly heading: (words: InvitationWords) => string;
  readonly added: (words: InvitationWords) => string;
  readonly howToSignIn: string;
  readonly openDashboard: string;
  readonly notExpected: string;
  readonly about: string;
  readonly reason: string;
  readonly dashboard: string;
  readonly logoAlt: string;
}

export const INVITATION_EMAIL_MESSAGES: Readonly<Record<EmailLanguage, InvitationEmailMessages>> = {
  en: {
    language: 'en',
    subject: (w) => `${w.inviter} added you to ${w.project} on Pyxis`,
    preheader: (w) => `Sign in with this address to see the reports of ${w.project}.`,
    heading: (w) => `You can now see ${w.project}`,
    added: (w) =>
      `${w.inviter} added you to the project ${w.project} on Pyxis. You can read its ` +
      'reports; only the owner of the account changes its settings.',
    howToSignIn:
      'There is no password: open the dashboard, type this address and a sign-in code arrives ' +
      'by email.',
    openDashboard: 'Open the dashboard',
    notExpected:
      'Don’t know who sent this? You can ignore this email: no one can sign in without the ' +
      'code sent to this address.',
    about: SIGN_IN_CODE_EMAIL_MESSAGES.en.about,
    reason:
      'You received this email because the owner of a Pyxis account added this address to one ' +
      'of its projects.',
    dashboard: 'Dashboard',
    logoAlt: 'Pyxis',
  },
  'pt-BR': {
    language: 'pt-BR',
    subject: (w) => `${w.inviter} adicionou você ao projeto ${w.project} no Pyxis`,
    preheader: (w) => `Entre com este endereço para ver os relatórios de ${w.project}.`,
    heading: (w) => `Você agora tem acesso a ${w.project}`,
    added: (w) =>
      `${w.inviter} adicionou você ao projeto ${w.project} no Pyxis. Você pode ler os ` +
      'relatórios; só o responsável pela conta muda as configurações.',
    howToSignIn:
      'Não há senha: abra o painel, digite este endereço e um código de acesso chega por ' +
      'e-mail.',
    openDashboard: 'Abrir o painel',
    notExpected:
      'Não sabe quem mandou? Pode ignorar este e-mail: ninguém entra sem o código enviado a ' +
      'este endereço.',
    about: SIGN_IN_CODE_EMAIL_MESSAGES['pt-BR'].about,
    reason:
      'Você recebeu este e-mail porque o responsável por uma conta do Pyxis adicionou este ' +
      'endereço a um dos projetos dela.',
    dashboard: 'Painel',
    logoAlt: 'Pyxis',
  },
  es: {
    language: 'es',
    subject: (w) => `${w.inviter} te agregó al proyecto ${w.project} en Pyxis`,
    preheader: (w) => `Entra con esta dirección para ver los informes de ${w.project}.`,
    heading: (w) => `Ahora tienes acceso a ${w.project}`,
    added: (w) =>
      `${w.inviter} te agregó al proyecto ${w.project} en Pyxis. Puedes leer sus informes; ` +
      'solo el titular de la cuenta cambia su configuración.',
    howToSignIn:
      'No hay contraseña: abre el panel, escribe esta dirección y te llegará un código de ' +
      'acceso por correo.',
    openDashboard: 'Abrir el panel',
    notExpected:
      '¿No sabes quién lo envió? Puedes ignorar este correo: nadie entra sin el código enviado ' +
      'a esta dirección.',
    about: SIGN_IN_CODE_EMAIL_MESSAGES.es.about,
    reason:
      'Recibiste este correo porque el titular de una cuenta de Pyxis agregó esta dirección a ' +
      'uno de sus proyectos.',
    dashboard: 'Panel',
    logoAlt: 'Pyxis',
  },
  de: {
    language: 'de',
    subject: (w) => `${w.inviter} hat dich bei Pyxis zu ${w.project} hinzugefügt`,
    preheader: (w) =>
      `Melde dich mit dieser Adresse an, um die Berichte von ${w.project} zu sehen.`,
    heading: (w) => `Du hast jetzt Zugriff auf ${w.project}`,
    added: (w) =>
      `${w.inviter} hat dich bei Pyxis zum Projekt ${w.project} hinzugefügt. Du kannst seine ` +
      'Berichte lesen; nur der Inhaber des Kontos ändert die Einstellungen.',
    howToSignIn:
      'Es gibt kein Passwort: Öffne das Dashboard, gib diese Adresse ein, und ein Anmeldecode ' +
      'kommt per E-Mail.',
    openDashboard: 'Dashboard öffnen',
    notExpected:
      'Du weißt nicht, wer das geschickt hat? Dann kannst du diese E-Mail ignorieren: Ohne den ' +
      'Code, der an diese Adresse geht, kann sich niemand anmelden.',
    about: SIGN_IN_CODE_EMAIL_MESSAGES.de.about,
    reason:
      'Du hast diese E-Mail bekommen, weil der Inhaber eines Pyxis-Kontos diese Adresse zu ' +
      'einem seiner Projekte hinzugefügt hat.',
    dashboard: 'Dashboard',
    logoAlt: 'Pyxis',
  },
  fr: {
    language: 'fr',
    subject: (w) => `${w.inviter} vous a ajouté au projet ${w.project} sur Pyxis`,
    preheader: (w) => `Connectez-vous avec cette adresse pour voir les rapports de ${w.project}.`,
    heading: (w) => `Vous avez maintenant accès à ${w.project}`,
    added: (w) =>
      `${w.inviter} vous a ajouté au projet ${w.project} sur Pyxis. Vous pouvez consulter ses ` +
      'rapports ; seul le propriétaire du compte modifie ses paramètres.',
    howToSignIn:
      'Il n’y a pas de mot de passe : ouvrez le tableau de bord, saisissez cette adresse et un ' +
      'code de connexion vous parvient par e-mail.',
    openDashboard: 'Ouvrir le tableau de bord',
    notExpected:
      'Vous ne savez pas qui vous l’a envoyé ? Vous pouvez ignorer cet e-mail : personne ne ' +
      'peut se connecter sans le code envoyé à cette adresse.',
    about: SIGN_IN_CODE_EMAIL_MESSAGES.fr.about,
    reason:
      'Vous recevez cet e-mail parce que le propriétaire d’un compte Pyxis a ajouté cette ' +
      'adresse ' +
      'à l’un de ses projets.',
    dashboard: 'Tableau de bord',
    logoAlt: 'Pyxis',
  },
  it: {
    language: 'it',
    subject: (w) => `${w.inviter} ti ha aggiunto al progetto ${w.project} su Pyxis`,
    preheader: (w) => `Accedi con questo indirizzo per vedere i report di ${w.project}.`,
    heading: (w) => `Ora hai accesso a ${w.project}`,
    added: (w) =>
      `${w.inviter} ti ha aggiunto al progetto ${w.project} su Pyxis. Puoi leggerne i report; ` +
      'solo il proprietario dell’account ne modifica le impostazioni.',
    howToSignIn:
      'Non c’è nessuna password: apri la dashboard, scrivi questo indirizzo e ti arriverà un ' +
      'codice di accesso via email.',
    openDashboard: 'Apri la dashboard',
    notExpected:
      'Non sai chi l’ha inviata? Puoi ignorare questa email: nessuno può accedere senza il ' +
      'codice inviato a questo indirizzo.',
    about: SIGN_IN_CODE_EMAIL_MESSAGES.it.about,
    reason:
      'Hai ricevuto questa email perché il proprietario di un account Pyxis ha aggiunto questo ' +
      'indirizzo a uno dei suoi progetti.',
    dashboard: 'Dashboard',
    logoAlt: 'Pyxis',
  },
  nl: {
    language: 'nl',
    subject: (w) => `${w.inviter} heeft je toegevoegd aan ${w.project} in Pyxis`,
    preheader: (w) => `Log in met dit adres om de rapporten van ${w.project} te bekijken.`,
    heading: (w) => `Je hebt nu toegang tot ${w.project}`,
    added: (w) =>
      `${w.inviter} heeft je toegevoegd aan het project ${w.project} in Pyxis. Je kunt de ` +
      'rapporten lezen; alleen de eigenaar van het account wijzigt de instellingen.',
    howToSignIn:
      'Er is geen wachtwoord: open het dashboard, typ dit adres en je krijgt een inlogcode ' +
      'per e-mail.',
    openDashboard: 'Dashboard openen',
    notExpected:
      'Weet je niet wie dit heeft gestuurd? Dan kun je deze e-mail negeren: niemand kan inloggen ' +
      'zonder de code die naar dit adres wordt gestuurd.',
    about: SIGN_IN_CODE_EMAIL_MESSAGES.nl.about,
    reason:
      'Je ontvangt deze e-mail omdat de eigenaar van een Pyxis-account dit adres heeft ' +
      'toegevoegd aan een van zijn projecten.',
    dashboard: 'Dashboard',
    logoAlt: 'Pyxis',
  },
};
