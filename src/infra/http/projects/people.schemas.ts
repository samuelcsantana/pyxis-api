import { z } from 'zod';
import { emailSchema, localeSchema } from '../auth/auth.schemas';

export const personSchema = z
  .strictObject({
    admin_user_id: z.uuid(),
    email: z.email(),
    role: z
      .enum(['owner', 'member'])
      .describe('The owner of the account changes the project; a member reads it'),
    added_at: z.iso.datetime(),
  })
  .meta({ id: 'ProjectPerson', description: 'Someone who reads the project.' });

export const projectPeopleSchema = z
  .strictObject({ people: z.array(personSchema) })
  .meta({ id: 'ProjectPeople', description: 'The people who read the project, oldest first.' });

export const newPersonSchema = z
  .strictObject({ email: emailSchema, locale: localeSchema.optional() })
  .meta({
    id: 'NewProjectPerson',
    description: 'The address to add, and the language of the invitation e-mail.',
  });

export const addedPersonSchema = z
  .strictObject({
    person: personSchema,
    added: z
      .boolean()
      .describe('False when the person already read the project; no e-mail goes out then'),
  })
  .meta({ id: 'AddedProjectPerson', description: 'The person, now on the project.' });

export type PersonBody = z.infer<typeof personSchema>;
export type ProjectPeopleBody = z.infer<typeof projectPeopleSchema>;
export type NewPersonBody = z.infer<typeof newPersonSchema>;
export type AddedPersonBody = z.infer<typeof addedPersonSchema>;
