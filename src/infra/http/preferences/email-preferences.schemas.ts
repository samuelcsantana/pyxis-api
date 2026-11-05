import { z } from 'zod';
import {
  CONVERSION_DROP_SHARE,
  FAILURE_SPIKE_FACTOR,
  MIN_COMPARED_CONVERSIONS,
  MIN_FAILED_WRITES,
  MIN_FAILURE_RATE,
  MIN_VISITS_BEFORE_SILENCE,
} from '../../../domain/alerts/alert-rules';

const PERCENT = 100;

const preferenceFields = {
  weekly_digest: z
    .boolean()
    .describe(
      'Whether the admin receives the weekly digest of this project, sent on Mondays with the ' +
        'week that closed on Sunday in the project time zone',
    ),
  no_events_alert: z
    .boolean()
    .describe(
      'Whether the admin is alerted when no event has arrived for 24 hours, after at least ' +
        `${String(MIN_VISITS_BEFORE_SILENCE)} visits in the seven days before`,
    ),
  failed_writes_alert: z
    .boolean()
    .describe(
      `Whether the admin is alerted when at least ${String(MIN_FAILED_WRITES)} writes failed ` +
        `yesterday, at least ${String(MIN_FAILURE_RATE * PERCENT)}% of them and ` +
        `${String(FAILURE_SPIKE_FACTOR)} times the rate of the seven days before`,
    ),
  conversion_drop_alert: z
    .boolean()
    .describe(
      'Whether the admin is alerted when the first goal was reached yesterday at most ' +
        `${String(CONVERSION_DROP_SHARE * PERCENT)}% as often as on the same weekday a week ` +
        `earlier, which had at least ${String(MIN_COMPARED_CONVERSIONS)}`,
    ),
};

export const emailPreferencesSchema = z.strictObject(preferenceFields).meta({
  id: 'EmailPreferences',
  description:
    'The e-mails the signed-in admin receives about one project: the weekly digest and the ' +
    'three alerts, each sent at most once a day.',
});

export const emailPreferenceChangesSchema = z
  .strictObject(z.object(preferenceFields).partial().shape)
  .refine((changes) => Object.keys(changes).length > 0, {
    message: 'Send at least one preference.',
  })
  .meta({
    id: 'EmailPreferenceChanges',
    description: 'The preferences to change; the ones left out keep their value.',
  });

export type EmailPreferencesBody = z.infer<typeof emailPreferencesSchema>;
export type EmailPreferenceChangesBody = z.infer<typeof emailPreferenceChangesSchema>;
