import { Inject, Injectable } from '@nestjs/common';
import { asc, eq, isNull } from 'drizzle-orm';
import { DEFAULT_EMAIL_LANGUAGE } from '../../domain/auth/email-language';
import type {
  SlackDestination,
  SlackDestinationsQuery,
} from '../../domain/slack/slack-destinations';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { accounts } from '../database/schema/accounts';
import { adminUsers } from '../database/schema/admins';
import { projects } from '../database/schema/projects';
import { projectSlackWebhooks } from '../database/schema/slack';
import { toProject } from '../repositories/drizzle-project.repository';

@Injectable()
export class DrizzleSlackDestinationsQuery implements SlackDestinationsQuery {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async destinations(): Promise<readonly SlackDestination[]> {
    const rows = await this.db
      .select({
        project: projects,
        sealed: projectSlackWebhooks.sealedUrl,
        account: {
          id: accounts.id,
          status: accounts.status,
          suspendedAt: accounts.suspendedAt,
          ingestionPausedUntil: accounts.ingestionPausedUntil,
        },
        ownerLanguage: adminUsers.emailLanguage,
      })
      .from(projectSlackWebhooks)
      .innerJoin(projects, eq(projectSlackWebhooks.projectId, projects.id))
      .leftJoin(accounts, eq(projects.accountId, accounts.id))
      .leftJoin(adminUsers, eq(accounts.ownerAdminId, adminUsers.id))
      .where(isNull(projectSlackWebhooks.brokenAt))
      .orderBy(asc(projects.name), asc(projects.id));
    return rows.map(({ project, sealed, account, ownerLanguage }) => ({
      project: toProject(project),
      account:
        account === null
          ? null
          : {
              status: account.status,
              suspendedAt: account.suspendedAt,
              ingestionPausedUntil: account.ingestionPausedUntil,
            },
      ingestionSuspended: project.ingestionSuspendedAt !== null,
      ownerLanguage: ownerLanguage ?? DEFAULT_EMAIL_LANGUAGE,
      sealedWebhook: sealed,
    }));
  }
}
