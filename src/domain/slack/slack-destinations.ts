import type { AlertedAccount } from '../alerts/alert-rules';
import type { AlertKind } from '../alerts/project-alert';
import type { EmailLanguage } from '../auth/email-language';
import type { Project } from '../entities/project.entity';

export interface SlackDestination {
  readonly project: Project;
  readonly account: AlertedAccount | null;
  readonly ingestionSuspended: boolean;
  readonly ownerLanguage: EmailLanguage;
  readonly sealedWebhook: string;
}

export interface SlackDestinationsQuery {
  destinations(): Promise<readonly SlackDestination[]>;
}

export const SLACK_DESTINATIONS_QUERY = Symbol('SlackDestinationsQuery');

export interface SlackAlertDelivery {
  readonly projectId: string;
  readonly kind: AlertKind;
  readonly day: string;
}

export interface SlackAlertDeliveryRepository {
  wasSent(delivery: SlackAlertDelivery): Promise<boolean>;
  recordSent(delivery: SlackAlertDelivery, sentAt: Date): Promise<void>;
}

export const SLACK_ALERT_DELIVERY_REPOSITORY = Symbol('SlackAlertDeliveryRepository');
