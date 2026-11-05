import type { EmailLanguage } from '../../domain/auth/email-language';

export interface SlackMessages {
  readonly connected: (project: string) => string;
}

export const SLACK_MESSAGES: Readonly<Record<EmailLanguage, SlackMessages>> = {
  en: {
    connected: (project) =>
      `Pyxis is connected: the alerts of ${project} will be posted to this channel.`,
  },
  'pt-BR': {
    connected: (project) =>
      `O Pyxis está conectado: os alertas de ${project} vão chegar neste canal.`,
  },
  es: {
    connected: (project) =>
      `Pyxis está conectado: las alertas de ${project} llegarán a este canal.`,
  },
  de: {
    connected: (project) =>
      `Pyxis ist verbunden: Die Hinweise zu ${project} kommen in diesen Kanal.`,
  },
  fr: {
    connected: (project) =>
      `Pyxis est connecté : les alertes de ${project} arriveront dans ce canal.`,
  },
  it: {
    connected: (project) =>
      `Pyxis è collegato: gli avvisi di ${project} arriveranno in questo canale.`,
  },
  nl: {
    connected: (project) => `Pyxis is verbonden: de meldingen van ${project} komen in dit kanaal.`,
  },
};
