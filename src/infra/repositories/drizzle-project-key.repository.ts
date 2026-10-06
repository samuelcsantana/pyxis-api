import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import type { ProjectKey } from '../../domain/entities/project-key.entity';
import type {
  LiveSecretKey,
  NewProjectKey,
  ProjectKeyRepository,
} from '../../domain/repositories/project-key.repository';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { insertedRow } from '../database/inserted-row';
import { projectKeys } from '../database/schema/project-keys';

type ProjectKeyRow = typeof projectKeys.$inferSelect;

function requiredColumn(value: string | null, column: string): string {
  if (value === null) {
    throw new Error(`project_keys.${column} is empty although the row's kind requires it.`);
  }
  return value;
}

export function toProjectKey(row: ProjectKeyRow): ProjectKey {
  const base = {
    id: row.id,
    projectId: row.projectId,
    createdAt: row.createdAt,
    revokedAt: row.revokedAt,
  };
  return row.kind === 'public'
    ? { ...base, kind: 'public', publicKey: requiredColumn(row.publicKey, 'public_key') }
    : { ...base, kind: 'secret', secretHash: requiredColumn(row.secretHash, 'secret_hash') };
}

@Injectable()
export class DrizzleProjectKeyRepository implements ProjectKeyRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async create(key: NewProjectKey): Promise<ProjectKey> {
    const row = insertedRow(await this.db.insert(projectKeys).values(key).returning());
    return toProjectKey(row);
  }

  async revoke(keyId: string, revokedAt: Date): Promise<boolean> {
    const revoked = await this.db
      .update(projectKeys)
      .set({ revokedAt })
      .where(and(eq(projectKeys.id, keyId), isNull(projectKeys.revokedAt)))
      .returning({ id: projectKeys.id });
    return revoked.length > 0;
  }

  async findLiveSecret(secretHash: string): Promise<LiveSecretKey | null> {
    const [row] = await this.db
      .select({
        keyId: projectKeys.id,
        projectId: projectKeys.projectId,
        secretHash: projectKeys.secretHash,
      })
      .from(projectKeys)
      .where(and(eq(projectKeys.secretHash, secretHash), isNull(projectKeys.revokedAt)))
      .limit(1);
    return row === undefined
      ? null
      : {
          keyId: row.keyId,
          projectId: row.projectId,
          secretHash: requiredColumn(row.secretHash, 'secret_hash'),
        };
  }
}
