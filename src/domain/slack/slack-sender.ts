import type { ProjectAlert } from '../alerts/project-alert';
import type { EmailLanguage } from '../auth/email-language';

export type SlackDelivery =
  | { readonly outcome: 'sent' }
  | { readonly outcome: 'gone'; readonly reason: string }
  | { readonly outcome: 'failed'; readonly status: number | null };

export interface SlackSender {
  postAlert(
    webhookUrl: string,
    alert: ProjectAlert,
    language: EmailLanguage,
  ): Promise<SlackDelivery>;
  postTest(
    webhookUrl: string,
    projectName: string,
    language: EmailLanguage,
  ): Promise<SlackDelivery>;
}

export const SLACK_SENDER = Symbol('SlackSender');
