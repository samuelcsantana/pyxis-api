import { z } from 'zod';
import { FUNNEL_SEGMENT_DIMENSIONS } from '../../../domain/queries/funnel';
import { funnelStepsSchema, rangeQuerySchema } from './query.schemas';

export const funnelSegmentsQuerySchema = rangeQuerySchema.extend({
  steps: funnelStepsSchema,
  by: z.enum(FUNNEL_SEGMENT_DIMENSIONS),
});

export const funnelSegmentsReportSchema = z
  .strictObject({
    by: z.enum(FUNNEL_SEGMENT_DIMENSIONS),
    segments: z.array(
      z.strictObject({
        segment: z
          .string()
          .describe(
            'The device type of the visit, or the channel of its first attributed page view; ' +
              '"unknown" when the visit has none',
          ),
        steps: z.array(z.int()).describe('How many visits of the segment reached each step'),
      }),
    ),
  })
  .meta({
    id: 'FunnelSegmentsReport',
    description:
      'The funnel per visit segment (visit mode only: a person has many devices): for each ' +
      'segment that reached the first step, the visits that reached each step, the largest ' +
      'segment first. The segments add up to the /funnel counts of the same steps.',
  });

export type FunnelSegmentsQuery = z.infer<typeof funnelSegmentsQuerySchema>;
export type FunnelSegmentsReportBody = z.infer<typeof funnelSegmentsReportSchema>;
