import { z } from 'zod';
import type { ProjectRestrictions } from '../../../domain/queries/project-restrictions';

export const projectRestrictionFields = {
  ingestion_suspended_at: z.iso
    .datetime()
    .nullable()
    .describe(
      "Since when the operator suspended the project's event reception (its batches answer " +
        '403 project_suspended while its screens stay open); null when it takes events',
    ),
  ingestion_suspension_reason: z
    .string()
    .nullable()
    .describe(
      'Why the reception is suspended, as told to the owner of the account; null for everyone ' +
        'else and when it is not suspended',
    ),
};

export interface ProjectRestrictionsBody {
  readonly ingestion_suspended_at: string | null;
  readonly ingestion_suspension_reason: string | null;
}

export function projectRestrictionsBody(
  restrictions: ProjectRestrictions,
): ProjectRestrictionsBody {
  return {
    ingestion_suspended_at:
      restrictions.ingestionSuspendedAt === null
        ? null
        : restrictions.ingestionSuspendedAt.toISOString(),
    ingestion_suspension_reason: restrictions.ingestionSuspensionReason,
  };
}
