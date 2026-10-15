import { z } from 'zod';
import { EXPORT_STATUSES } from '../../../domain/exports/project-export';

const isoDate = z.iso.datetime().nullable();

export const projectExportSchema = z
  .strictObject({
    id: z.uuid(),
    status: z.enum(EXPORT_STATUSES),
    requested_at: z.iso.datetime(),
    finished_at: isoDate,
    event_count: z.int().nullable(),
    available_until: isoDate.describe(
      'Until when the file can be downloaded; null before it is ready',
    ),
    download_url: z
      .url()
      .nullable()
      .describe('A link to the file, valid for five minutes; null unless the file is ready'),
  })
  .meta({ id: 'ProjectExport', description: "An export of a project's events." });

export const requestedExportSchema = z
  .strictObject({
    export: projectExportSchema,
    requested: z
      .boolean()
      .describe('False when an export of the project was already waiting; that one is answered'),
  })
  .meta({
    id: 'RequestedExport',
    description: 'The export, being prepared; an e-mail tells the owner when it is ready.',
  });

export type ProjectExportBody = z.infer<typeof projectExportSchema>;
export type RequestedExportBody = z.infer<typeof requestedExportSchema>;
