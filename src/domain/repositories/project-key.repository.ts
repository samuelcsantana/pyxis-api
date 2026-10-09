import type { ProjectKey } from '../entities/project-key.entity';

export type NewProjectKey =
  | { readonly projectId: string; readonly kind: 'public'; readonly publicKey: string }
  | { readonly projectId: string; readonly kind: 'secret'; readonly secretHash: string };

export interface LiveSecretKey {
  readonly keyId: string;
  readonly projectId: string;
  readonly secretHash: string;
}

export interface ProjectKeyRepository {
  create(key: NewProjectKey): Promise<ProjectKey>;
  revoke(keyId: string, revokedAt: Date): Promise<boolean>;
  findLiveSecret(secretHash: string): Promise<LiveSecretKey | null>;
  liveKeysOf(projectId: string): Promise<readonly ProjectKey[]>;
}

export const PROJECT_KEY_REPOSITORY = Symbol('ProjectKeyRepository');
