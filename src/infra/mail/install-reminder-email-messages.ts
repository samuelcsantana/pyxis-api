import type { EmailLanguage } from '../../domain/auth/email-language';
import { SIGN_IN_CODE_EMAIL_MESSAGES } from './sign-in-code-email-messages';
import { WELCOME_EMAIL_MESSAGES } from './welcome-email-messages';

export interface InstallWay {
  readonly name: string;
  readonly how: string;
}

export interface InstallReminderCopy<Intro> {
  readonly subject: string;
  readonly preheader: string;
  readonly heading: string;
  readonly intro: Intro;
  readonly lead: string;
  readonly button: string;
}

export interface InstallReminderEmailMessages {
  readonly language: EmailLanguage;
  readonly withProject: InstallReminderCopy<(project: string) => string>;
  readonly withoutProject: InstallReminderCopy<string>;
  readonly ways: readonly [InstallWay, InstallWay, InstallWay];
  readonly colon: string;
  readonly closing: string;
  readonly about: string;
  readonly reason: string;
  readonly dashboard: string;
  readonly logoAlt: string;
}

export const INSTALL_REMINDER_EMAIL_MESSAGES: Readonly<
  Record<EmailLanguage, InstallReminderEmailMessages>
> = {
  en: {
    language: 'en',
    withProject: {
      subject: 'Your Pyxis project is waiting for its first visit',
      preheader: 'Install Pyxis on your site in one of three ways.',
      heading: 'Waiting for the first visit',
      intro: (project) =>
        `Your project ${project} is ready, but no visit has reached it yet: Pyxis starts ` +
        'measuring once it is installed on your site.',
      lead: 'Its Install screen shows three ways, with the project’s key already filled in:',
      button: 'Open Install',
    },
    withoutProject: {
      subject: 'Create your first Pyxis project',
      preheader: 'Then install Pyxis on your site in one of three ways.',
      heading: 'Create your first project',
      intro:
        'Your Pyxis account is ready, but it has no project yet. A project measures one site: ' +
        'create it in the dashboard with your site’s address.',
      lead: 'Its Install screen then shows three ways, with the project’s key already filled in:',
      button: WELCOME_EMAIL_MESSAGES.en.openDashboard,
    },
    ways: [
      {
        name: 'Yourself',
        how: 'add the pyxis-analytics npm package, or a script tag, to your pages.',
      },
      {
        name: 'With an AI agent',
        how:
          'paste the ready request into Claude Code, Cursor or another coding agent, and it ' +
          'adds Pyxis to your site’s code for you to review.',
      },
      {
        name: 'Google Tag Manager',
        how:
          'add the Pyxis template to your container, with no code. It also works on ' +
          'Nuvemshop’s paid plans.',
      },
    ],
    colon: ': ',
    closing:
      'Once it is installed, the first visit shows up within a minute. This is the only ' +
      'reminder we will send.',
    about: SIGN_IN_CODE_EMAIL_MESSAGES.en.about,
    reason: WELCOME_EMAIL_MESSAGES.en.freeReason,
    dashboard: 'Dashboard',
    logoAlt: 'Pyxis',
  },
  'pt-BR': {
    language: 'pt-BR',
    withProject: {
      subject: 'Seu projeto no Pyxis está esperando a primeira visita',
      preheader: 'Instale o Pyxis no seu site de uma de três formas.',
      heading: 'Esperando a primeira visita',
      intro: (project) =>
        `Seu projeto ${project} está pronto, mas nenhuma visita chegou ainda: o Pyxis começa a ` +
        'medir quando é instalado no seu site.',
      lead: 'A tela de Instalação do projeto mostra três formas, já com a chave dele preenchida:',
      button: 'Abrir a Instalação',
    },
    withoutProject: {
      subject: 'Crie seu primeiro projeto no Pyxis',
      preheader: 'Depois, instale o Pyxis no seu site de uma de três formas.',
      heading: 'Crie seu primeiro projeto',
      intro:
        'Sua conta no Pyxis está pronta, mas ainda não tem nenhum projeto. Um projeto mede um ' +
        'site: crie o seu no painel com o endereço do seu site.',
      lead:
        'Depois, a tela de Instalação do projeto mostra três formas, já com a chave dele ' +
        'preenchida:',
      button: WELCOME_EMAIL_MESSAGES['pt-BR'].openDashboard,
    },
    ways: [
      {
        name: 'Você mesmo',
        how: 'coloque o pacote npm pyxis-analytics, ou uma tag script, nas suas páginas.',
      },
      {
        name: 'Com um agente de IA',
        how:
          'cole o pedido pronto no Claude Code, no Cursor ou em outro agente de código, e ele ' +
          'coloca o Pyxis no código do seu site para você revisar.',
      },
      {
        name: 'Google Tag Manager',
        how:
          'adicione o modelo do Pyxis ao seu contêiner, sem código. Também funciona nos planos ' +
          'pagos da Nuvemshop.',
      },
    ],
    colon: ': ',
    closing:
      'Depois de instalado, a primeira visita aparece em até um minuto. Este é o único lembrete ' +
      'que vamos enviar.',
    about: SIGN_IN_CODE_EMAIL_MESSAGES['pt-BR'].about,
    reason: WELCOME_EMAIL_MESSAGES['pt-BR'].freeReason,
    dashboard: 'Painel',
    logoAlt: 'Pyxis',
  },
  es: {
    language: 'es',
    withProject: {
      subject: 'Tu proyecto de Pyxis espera su primera visita',
      preheader: 'Instala Pyxis en tu sitio de una de tres formas.',
      heading: 'Esperando la primera visita',
      intro: (project) =>
        `Tu proyecto ${project} está listo, pero todavía no recibió ninguna visita: Pyxis ` +
        'empieza a medir cuando está instalado en tu sitio.',
      lead: 'Su pantalla de Instalación muestra tres formas, con la clave del proyecto ya incluida:',
      button: 'Abrir la Instalación',
    },
    withoutProject: {
      subject: 'Crea tu primer proyecto de Pyxis',
      preheader: 'Después, instala Pyxis en tu sitio de una de tres formas.',
      heading: 'Crea tu primer proyecto',
      intro:
        'Tu cuenta de Pyxis está lista, pero todavía no tiene ningún proyecto. Un proyecto mide ' +
        'un sitio: créalo en el panel con la dirección de tu sitio.',
      lead:
        'Después, su pantalla de Instalación muestra tres formas, con la clave del proyecto ya ' +
        'incluida:',
      button: WELCOME_EMAIL_MESSAGES.es.openDashboard,
    },
    ways: [
      {
        name: 'Por tu cuenta',
        how: 'agrega a tus páginas el paquete npm pyxis-analytics o una etiqueta script.',
      },
      {
        name: 'Con un agente de IA',
        how:
          'pega la petición lista en Claude Code, en Cursor o en otro agente de código, y el ' +
          'agente agrega Pyxis al código de tu sitio para que lo revises.',
      },
      {
        name: 'Google Tag Manager',
        how:
          'agrega la plantilla de Pyxis a tu contenedor, sin código. También funciona en los ' +
          'planes de pago de Nuvemshop.',
      },
    ],
    colon: ': ',
    closing:
      'Una vez instalado, la primera visita aparece en menos de un minuto. Es el único ' +
      'recordatorio que te enviaremos.',
    about: SIGN_IN_CODE_EMAIL_MESSAGES.es.about,
    reason: WELCOME_EMAIL_MESSAGES.es.freeReason,
    dashboard: 'Panel',
    logoAlt: 'Pyxis',
  },
  de: {
    language: 'de',
    withProject: {
      subject: 'Dein Pyxis-Projekt wartet auf seinen ersten Besuch',
      preheader: 'Installiere Pyxis auf einem von drei Wegen auf deiner Website.',
      heading: 'Warten auf den ersten Besuch',
      intro: (project) =>
        `Dein Projekt ${project} ist bereit, aber noch kein Besuch ist angekommen: Pyxis misst, ` +
        'sobald es auf deiner Website installiert ist.',
      lead:
        'Die Seite „Installieren“ des Projekts zeigt drei Wege, mit seinem Schlüssel schon ' +
        'eingetragen:',
      button: 'Seite „Installieren“ öffnen',
    },
    withoutProject: {
      subject: 'Lege dein erstes Pyxis-Projekt an',
      preheader: 'Danach installierst du Pyxis auf einem von drei Wegen auf deiner Website.',
      heading: 'Lege dein erstes Projekt an',
      intro:
        'Dein Pyxis-Konto ist bereit, hat aber noch kein Projekt. Ein Projekt misst eine ' +
        'Website: Lege es im Dashboard mit der Adresse deiner Website an.',
      lead:
        'Danach zeigt seine Seite „Installieren“ drei Wege, mit dem Schlüssel des Projekts schon ' +
        'eingetragen:',
      button: WELCOME_EMAIL_MESSAGES.de.openDashboard,
    },
    ways: [
      {
        name: 'Selbst',
        how: 'Füge deinen Seiten das npm-Paket pyxis-analytics oder ein Script-Tag hinzu.',
      },
      {
        name: 'Mit einem KI-Agenten',
        how:
          'Füge die fertige Anfrage in Claude Code, Cursor oder einen anderen Coding-Agenten ' +
          'ein; er baut Pyxis in den Code deiner Website ein, und du prüfst seine Änderungen.',
      },
      {
        name: 'Google Tag Manager',
        how:
          'Füge die Pyxis-Vorlage deinem Container hinzu, ganz ohne Code. Das geht auch mit den ' +
          'kostenpflichtigen Tarifen von Nuvemshop.',
      },
    ],
    colon: ': ',
    closing:
      'Sobald es installiert ist, erscheint der erste Besuch innerhalb einer Minute. Das ist die ' +
      'einzige Erinnerung, die wir dir schicken.',
    about: SIGN_IN_CODE_EMAIL_MESSAGES.de.about,
    reason: WELCOME_EMAIL_MESSAGES.de.freeReason,
    dashboard: 'Dashboard',
    logoAlt: 'Pyxis',
  },
  fr: {
    language: 'fr',
    withProject: {
      subject: 'Votre projet Pyxis attend sa première visite',
      preheader: 'Installez Pyxis sur votre site, de trois façons au choix.',
      heading: 'En attente de la première visite',
      intro: (project) =>
        `Votre projet ${project} est prêt, mais aucune visite ne lui est encore parvenue\u00a0: ` +
        'Pyxis commence à mesurer une fois installé sur votre site.',
      lead:
        'Sa page Installation propose trois façons de faire, avec la clé du projet déjà ' +
        'renseignée\u00a0:',
      button: 'Ouvrir la page Installation',
    },
    withoutProject: {
      subject: 'Créez votre premier projet Pyxis',
      preheader: 'Ensuite, installez Pyxis sur votre site, de trois façons au choix.',
      heading: 'Créez votre premier projet',
      intro:
        'Votre compte Pyxis est prêt, mais il n’a encore aucun projet. Un projet mesure un ' +
        'site\u00a0: créez-le dans le tableau de bord avec l’adresse de votre site.',
      lead:
        'Sa page Installation propose ensuite trois façons de faire, avec la clé du projet déjà ' +
        'renseignée\u00a0:',
      button: WELCOME_EMAIL_MESSAGES.fr.openDashboard,
    },
    ways: [
      {
        name: 'Vous-même',
        how: 'ajoutez à vos pages le paquet npm pyxis-analytics ou une balise script.',
      },
      {
        name: 'Avec un agent IA',
        how:
          'collez la demande toute prête dans Claude Code, Cursor ou un autre agent de ' +
          'code\u202f; il ajoute Pyxis au code de votre site, et vous vérifiez ses changements.',
      },
      {
        name: 'Google Tag Manager',
        how:
          'ajoutez le modèle Pyxis à votre conteneur, sans code. Cela fonctionne aussi avec les ' +
          'formules payantes de Nuvemshop.',
      },
    ],
    colon: '\u00a0: ',
    closing:
      'Une fois Pyxis installé, la première visite apparaît en moins d’une minute. C’est le seul ' +
      'rappel que nous vous enverrons.',
    about: SIGN_IN_CODE_EMAIL_MESSAGES.fr.about,
    reason: WELCOME_EMAIL_MESSAGES.fr.freeReason,
    dashboard: 'Tableau de bord',
    logoAlt: 'Pyxis',
  },
  it: {
    language: 'it',
    withProject: {
      subject: 'Il tuo progetto Pyxis aspetta la sua prima visita',
      preheader: 'Installa Pyxis sul tuo sito in uno dei tre modi.',
      heading: 'In attesa della prima visita',
      intro: (project) =>
        `Il tuo progetto ${project} è pronto, ma non ha ancora ricevuto nessuna visita: Pyxis ` +
        'inizia a misurare quando è installato sul tuo sito.',
      lead: 'La sua pagina Installazione mostra tre modi, con la chiave del progetto già inserita:',
      button: 'Apri la pagina Installazione',
    },
    withoutProject: {
      subject: 'Crea il tuo primo progetto Pyxis',
      preheader: 'Poi installa Pyxis sul tuo sito in uno dei tre modi.',
      heading: 'Crea il tuo primo progetto',
      intro:
        'Il tuo account Pyxis è pronto, ma non ha ancora nessun progetto. Un progetto misura un ' +
        'sito: crealo nella dashboard con l’indirizzo del tuo sito.',
      lead:
        'Poi la sua pagina Installazione mostra tre modi, con la chiave del progetto già ' +
        'inserita:',
      button: WELCOME_EMAIL_MESSAGES.it.openDashboard,
    },
    ways: [
      {
        name: 'Per conto tuo',
        how: 'aggiungi alle tue pagine il pacchetto npm pyxis-analytics o un tag script.',
      },
      {
        name: 'Con un agente IA',
        how:
          'incolla la richiesta già pronta in Claude Code, in Cursor o in un altro agente di ' +
          'programmazione; l’agente aggiunge Pyxis al codice del tuo sito e tu controlli le ' +
          'modifiche.',
      },
      {
        name: 'Google Tag Manager',
        how:
          'aggiungi il modello Pyxis al tuo contenitore, senza codice. Funziona anche con i ' +
          'piani a pagamento di Nuvemshop.',
      },
    ],
    colon: ': ',
    closing:
      'Una volta installato, la prima visita compare entro un minuto. È l’unico promemoria che ' +
      'ti invieremo.',
    about: SIGN_IN_CODE_EMAIL_MESSAGES.it.about,
    reason: WELCOME_EMAIL_MESSAGES.it.freeReason,
    dashboard: 'Dashboard',
    logoAlt: 'Pyxis',
  },
  nl: {
    language: 'nl',
    withProject: {
      subject: 'Je Pyxis-project wacht op zijn eerste bezoek',
      preheader: 'Installeer Pyxis op je site, op een van drie manieren.',
      heading: 'Wachten op het eerste bezoek',
      intro: (project) =>
        `Je project ${project} staat klaar, maar er is nog geen bezoek binnengekomen: Pyxis ` +
        'begint te meten zodra het op je site is geïnstalleerd.',
      lead:
        'De pagina Installeren van het project toont drie manieren, met de sleutel van het ' +
        'project al ingevuld:',
      button: 'Pagina Installeren openen',
    },
    withoutProject: {
      subject: 'Maak je eerste Pyxis-project aan',
      preheader: 'Installeer daarna Pyxis op je site, op een van drie manieren.',
      heading: 'Maak je eerste project aan',
      intro:
        'Je Pyxis-account staat klaar, maar heeft nog geen project. Een project meet één site: ' +
        'maak het aan in het dashboard met het adres van je site.',
      lead:
        'Daarna toont de pagina Installeren van het project drie manieren, met de sleutel al ' +
        'ingevuld:',
      button: WELCOME_EMAIL_MESSAGES.nl.openDashboard,
    },
    ways: [
      {
        name: 'Zelf',
        how: 'zet het npm-pakket pyxis-analytics of een scripttag in je pagina’s.',
      },
      {
        name: 'Met een AI-agent',
        how:
          'plak het kant-en-klare verzoek in Claude Code, Cursor of een andere coding-agent; ' +
          'die zet Pyxis in de code van je site, en jij controleert de wijzigingen.',
      },
      {
        name: 'Google Tag Manager',
        how:
          'voeg de Pyxis-template toe aan je container, zonder code. Dat werkt ook met de ' +
          'betaalde abonnementen van Nuvemshop.',
      },
    ],
    colon: ': ',
    closing:
      'Zodra het is geïnstalleerd, verschijnt het eerste bezoek binnen een minuut. Dit is de ' +
      'enige herinnering die we je sturen.',
    about: SIGN_IN_CODE_EMAIL_MESSAGES.nl.about,
    reason: WELCOME_EMAIL_MESSAGES.nl.freeReason,
    dashboard: 'Dashboard',
    logoAlt: 'Pyxis',
  },
};
