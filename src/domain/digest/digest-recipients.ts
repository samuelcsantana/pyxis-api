import type { EmailLanguage } from '../auth/email-language';
import type { Project } from '../entities/project.entity';

export interface DigestRecipient {
  readonly adminUserId: string;
  readonly email: string;
  readonly emailLanguage: EmailLanguage;
  readonly project: Project;
}

export interface DigestRecipientsQuery {
  recipients(): Promise<readonly DigestRecipient[]>;
}

export const DIGEST_RECIPIENTS_QUERY = Symbol('DigestRecipientsQuery');
