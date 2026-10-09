import { z } from 'zod';

export const emailPreferencesSchema = z
  .strictObject({
    weekly_digest: z
      .boolean()
      .describe(
        'Whether the admin receives the weekly digest of this project, sent on Mondays with the ' +
          'week that closed on Sunday in the project time zone',
      ),
  })
  .meta({
    id: 'EmailPreferences',
    description: 'The e-mails the signed-in admin receives about one project.',
  });

export type EmailPreferencesBody = z.infer<typeof emailPreferencesSchema>;
