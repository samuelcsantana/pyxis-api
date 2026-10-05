interface ProjectKeyBase {
  readonly id: string;
  readonly projectId: string;
  readonly createdAt: Date;
  readonly revokedAt: Date | null;
}

export interface PublicProjectKey extends ProjectKeyBase {
  readonly kind: 'public';
  readonly publicKey: string;
}

export interface SecretProjectKey extends ProjectKeyBase {
  readonly kind: 'secret';
  readonly secretHash: string;
}

export type ProjectKey = PublicProjectKey | SecretProjectKey;
