import { Inject, Injectable } from '@nestjs/common';
import { asc, eq, or } from 'drizzle-orm';
import type { AlertRecipient, AlertRecipientsQuery } from '../../domain/alerts/alert-recipients';
import type { AlertKind } from '../../domain/alerts/project-alert';
import { DRIZZLE_CLIENT } from '../database/drizzle.constants';
import type { DrizzleDatabase } from '../database/drizzle.types';
import { accounts } from '../database/schema/accounts';
import { adminProjectAccess, adminUsers } from '../database/schema/admins';
import { projects } from '../database/schema/projects';
import { toProject } from '../repositories/drizzle-project.repository';

interface AlertSwitches {
  readonly noEvents: boolean;
  readonly failedWrites: boolean;
  readonly conversionDrop: boolean;
}

function kindsOf(switches: AlertSwitches): readonly AlertKind[] {
  const wanted: readonly (readonly [AlertKind, boolean])[] = [
    ['no_events', switches.noEvents],
    ['failed_writes', switches.failedWrites],
    ['conversion_drop', switches.conversionDrop],
  ];
  return wanted.filter(([, on]) => on).map(([kind]) => kind);
}

@Injectable()
export class DrizzleAlertRecipientsQuery implements AlertRecipientsQuery {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDatabase) {}

  async recipients(): Promise<readonly AlertRecipient[]> {
    const rows = await this.db
      .select({
        admin: adminUsers,
        project: projects,
        account: {
          id: accounts.id,
          status: accounts.status,
          suspendedAt: accounts.suspendedAt,
          ingestionPausedUntil: accounts.ingestionPausedUntil,
        },
        switches: {
          noEvents: adminProjectAccess.noEventsAlert,
          failedWrites: adminProjectAccess.failedWritesAlert,
          conversionDrop: adminProjectAccess.conversionDropAlert,
        },
      })
      .from(adminProjectAccess)
      .innerJoin(adminUsers, eq(adminProjectAccess.adminUserId, adminUsers.id))
      .innerJoin(projects, eq(adminProjectAccess.projectId, projects.id))
      .leftJoin(accounts, eq(projects.accountId, accounts.id))
      .where(
        or(
          eq(adminProjectAccess.noEventsAlert, true),
          eq(adminProjectAccess.failedWritesAlert, true),
          eq(adminProjectAccess.conversionDropAlert, true),
        ),
      )
      .orderBy(asc(projects.name), asc(projects.id), asc(adminUsers.email));
    return rows.map(({ admin, project, account, switches }) => ({
      adminUserId: admin.id,
      email: admin.email,
      emailLanguage: admin.emailLanguage,
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
      kinds: kindsOf(switches),
    }));
  }
}
