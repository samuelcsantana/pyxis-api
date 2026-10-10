import type { UserAgentClassification } from '../events/user-agent';

export type SessionDevice = UserAgentClassification;

export interface AdminSession {
  readonly id: string;
  readonly adminUserId: string;
  readonly createdAt: Date;
  readonly lastUsedAt: Date;
  readonly device: SessionDevice | null;
}
