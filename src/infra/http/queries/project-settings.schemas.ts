import { z } from 'zod';

const keyCreatedAtSchema = z.iso.datetime().describe('When the key was created');

export const projectSettingsSchema = z
  .strictObject({
    id: z.uuid(),
    name: z.string(),
    timezone: z.string().describe('The IANA time zone the days of every report are counted in'),
    conversion_event: z
      .string()
      .nullable()
      .describe('The event counted as a conversion; null when the project has none'),
    allowed_origins: z
      .array(z.string())
      .describe('The origins whose pages may send events with a public key'),
    created_at: z.iso.datetime(),
    first_event_at: z.iso
      .datetime()
      .nullable()
      .describe('When the oldest event kept for the project happened; null before the first'),
    last_event_at: z.iso
      .datetime()
      .nullable()
      .describe('When the newest event of the project happened; null before the first'),
    event_retention_months: z
      .int()
      .describe('How many months an event is kept before the daily retention job deletes it'),
    public_keys: z
      .array(z.strictObject({ id: z.uuid(), key: z.string(), created_at: keyCreatedAtSchema }))
      .describe('The live public keys, oldest first; a public key ships in the site, not a secret'),
    secret_keys: z
      .array(z.strictObject({ id: z.uuid(), created_at: keyCreatedAtSchema }))
      .describe(
        'The live secret keys, oldest first, by id and creation time only: a secret key is ' +
          'stored as a hash and never shown',
      ),
  })
  .meta({
    id: 'ProjectSettings',
    description: 'The settings of a project, read-only: they change through the command line.',
  });

export type ProjectSettingsBody = z.infer<typeof projectSettingsSchema>;
