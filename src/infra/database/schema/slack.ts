import { sql } from 'drizzle-orm';
import {
  check,
  date,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { ALERT_KINDS, type AlertKind } from '../../../domain/alerts/project-alert';
import {
  MAX_SLACK_BROKEN_REASON_LENGTH,
  SLACK_WEBHOOK_HINT_LENGTH,
} from '../../../domain/slack/slack-webhook';
import { projects } from './projects';

const ALERT_KIND_LENGTH = 16;
const ALERT_KIND_VALUES = sql.raw(ALERT_KINDS.map((kind) => `'${kind}'`).join(', '));

export const projectSlackWebhooks = pgTable('project_slack_webhooks', {
  projectId: uuid('project_id')
    .primaryKey()
    .references(() => projects.id, { onDelete: 'cascade' }),
  sealedUrl: text('sealed_url').notNull(),
  hint: varchar('hint', { length: SLACK_WEBHOOK_HINT_LENGTH }).notNull(),
  connectedAt: timestamp('connected_at', { withTimezone: true }).notNull(),
  brokenAt: timestamp('broken_at', { withTimezone: true }),
  brokenReason: varchar('broken_reason', { length: MAX_SLACK_BROKEN_REASON_LENGTH }),
});

export const slackAlertDeliveries = pgTable(
  'slack_alert_deliveries',
  {
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { length: ALERT_KIND_LENGTH }).$type<AlertKind>().notNull(),
    day: date('day', { mode: 'string' }).notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({
      name: 'slack_alert_deliveries_pkey',
      columns: [table.projectId, table.kind, table.day],
    }),
    check('slack_alert_deliveries_kind_check', sql`${table.kind} in (${ALERT_KIND_VALUES})`),
  ],
);
