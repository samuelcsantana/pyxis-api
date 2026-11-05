import type { EmailLanguage } from '../auth/email-language';
import type { Project } from '../entities/project.entity';
import type { AlertedAccount } from './alert-rules';
import type { AlertKind } from './project-alert';

export interface AlertRecipient {
  readonly adminUserId: string;
  readonly email: string;
  readonly emailLanguage: EmailLanguage;
  readonly project: Project;
  readonly account: AlertedAccount | null;
  readonly ingestionSuspended: boolean;
  readonly kinds: readonly AlertKind[];
}

export interface AlertRecipientsQuery {
  recipients(): Promise<readonly AlertRecipient[]>;
}

export const ALERT_RECIPIENTS_QUERY = Symbol('AlertRecipientsQuery');

export interface AlertDelivery {
  readonly projectId: string;
  readonly adminUserId: string;
  readonly kind: AlertKind;
  readonly day: string;
}

export interface AlertDeliveryRepository {
  wasSent(delivery: AlertDelivery): Promise<boolean>;
  recordSent(delivery: AlertDelivery, sentAt: Date): Promise<void>;
}

export const ALERT_DELIVERY_REPOSITORY = Symbol('AlertDeliveryRepository');
