import { z } from 'zod';
import {
  MAX_ALLOWED_ORIGINS,
  MAX_PROJECT_NAME_LENGTH,
} from '../../../domain/projects/project-settings';

const MAX_ORIGIN_LENGTH = 300;
const MAX_TIMEZONE_LENGTH = 64;
const MAX_EVENT_NAME_LENGTH = 64;

const nameSchema = z.string().min(1).max(MAX_PROJECT_NAME_LENGTH);
const originsSchema = z
  .array(z.string().max(MAX_ORIGIN_LENGTH))
  .min(1)
  .max(MAX_ALLOWED_ORIGINS)
  .describe('Scheme, host and port of each site that sends events, as its Origin header says');
const timezoneSchema = z
  .string()
  .max(MAX_TIMEZONE_LENGTH)
  .describe('An IANA time zone, such as America/Sao_Paulo');
const conversionEventSchema = z.string().max(MAX_EVENT_NAME_LENGTH);

export const newProjectSchema = z
  .strictObject({
    name: nameSchema,
    allowed_origins: originsSchema,
    timezone: timezoneSchema.optional(),
    conversion_event: conversionEventSchema.optional(),
  })
  .meta({ id: 'NewProject', description: 'A project to create in the account.' });

export const createdProjectSchema = z
  .strictObject({
    project_id: z.uuid(),
    public_key: z.strictObject({ id: z.uuid(), key: z.string() }),
  })
  .meta({
    id: 'CreatedProject',
    description: 'The new project and the public key its site sends events with.',
  });

export const projectChangesSchema = z
  .strictObject({
    name: nameSchema.optional(),
    allowed_origins: originsSchema.optional(),
    timezone: timezoneSchema.optional(),
    conversion_event: conversionEventSchema
      .nullable()
      .optional()
      .describe('The event counted as a conversion; null clears it'),
    city_enabled: z
      .boolean()
      .optional()
      .describe(
        "Keep the visitor's approximate city on new events; off by default. Turning it off " +
          'stops reading the city at once and erases the cities already kept within a day.',
      ),
  })
  .meta({ id: 'ProjectChanges', description: 'The settings to change; the rest stay.' });

export const managedProjectSchema = z
  .strictObject({
    id: z.uuid(),
    name: z.string(),
    allowed_origins: z.array(z.string()),
    timezone: z.string(),
    conversion_event: z.string().nullable(),
    city_enabled: z.boolean(),
    created_at: z.iso.datetime(),
  })
  .meta({ id: 'ManagedProject', description: 'The settings of the project after the change.' });

export const newKeySchema = z
  .strictObject({ kind: z.enum(['public', 'secret']) })
  .meta({ id: 'NewProjectKey', description: 'The kind of key to create.' });

export const createdKeySchema = z
  .strictObject({
    id: z.uuid(),
    kind: z.enum(['public', 'secret']),
    key: z
      .string()
      .describe('The key itself; a secret key is shown only in this answer, never again'),
  })
  .meta({ id: 'CreatedProjectKey', description: 'The new key.' });

export const projectDeletionSchema = z
  .strictObject({
    confirm_name: z
      .string()
      .min(1)
      .max(MAX_PROJECT_NAME_LENGTH)
      .describe("The project's name, typed again"),
  })
  .meta({ id: 'ProjectDeletion', description: 'The confirmation of a deletion.' });

export const deletedProjectSchema = z
  .strictObject({
    project_id: z.uuid(),
    deleted_events: z.int(),
    deleted_keys: z.int(),
  })
  .meta({ id: 'DeletedProject', description: 'What the deletion removed.' });

export const idSchema = z.uuid();

export type NewProjectBody = z.infer<typeof newProjectSchema>;
export type CreatedProjectBody = z.infer<typeof createdProjectSchema>;
export type ProjectChangesBody = z.infer<typeof projectChangesSchema>;
export type ManagedProjectBody = z.infer<typeof managedProjectSchema>;
export type NewKeyBody = z.infer<typeof newKeySchema>;
export type CreatedKeyBody = z.infer<typeof createdKeySchema>;
export type ProjectDeletionBody = z.infer<typeof projectDeletionSchema>;
export type DeletedProjectBody = z.infer<typeof deletedProjectSchema>;
