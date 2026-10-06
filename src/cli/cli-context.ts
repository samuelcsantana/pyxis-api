import postgres from 'postgres';
import { validateEnv } from '../config/env.schema';
import { SystemClock } from '../infra/clock/system-clock';
import { migrationConnectionString } from '../infra/database/migrations';
import { createDrizzleDatabase } from '../infra/database/postgres-client';
import { CONNECT_TIMEOUT_SECONDS } from '../infra/database/postgres-options';
import { CryptoRandomSource } from '../infra/random/crypto-random-source';
import { DrizzleAdminUserRepository } from '../infra/repositories/drizzle-admin-user.repository';
import { DrizzleProjectKeyRepository } from '../infra/repositories/drizzle-project-key.repository';
import { DrizzleProjectSettingsRepository } from '../infra/repositories/drizzle-project-settings.repository';
import { GrantAdminAccessUseCase } from '../usecases/auth/grant-admin-access.usecase';
import { CreateProjectKeyUseCase } from '../usecases/projects/create-project-key.usecase';
import { CreateProjectUseCase } from '../usecases/projects/create-project.usecase';
import { RevokeProjectKeyUseCase } from '../usecases/projects/revoke-project-key.usecase';
import { UpdateProjectUseCase } from '../usecases/projects/update-project.usecase';
import type { CliContext } from './cli-command';

export function writeNoticeToStderr(notice: { readonly message?: string }): void {
  process.stderr.write(`postgres notice: ${notice.message ?? ''}\n`);
}

export function openCliContext(env: Record<string, string | undefined>): CliContext {
  const client = postgres(migrationConnectionString(validateEnv(env)), {
    max: 1,
    connect_timeout: CONNECT_TIMEOUT_SECONDS,
    onnotice: writeNoticeToStderr,
  });
  const db = createDrizzleDatabase(client);
  const settings = new DrizzleProjectSettingsRepository(db);
  const keys = new DrizzleProjectKeyRepository(db);
  const random = new CryptoRandomSource();
  return {
    createProject: new CreateProjectUseCase(settings, random),
    createProjectKey: new CreateProjectKeyUseCase(settings, keys, random),
    revokeProjectKey: new RevokeProjectKeyUseCase(keys, new SystemClock()),
    updateProject: new UpdateProjectUseCase(settings),
    grantAdminAccess: new GrantAdminAccessUseCase(settings, new DrizzleAdminUserRepository(db)),
    close: () => client.end(),
  };
}
